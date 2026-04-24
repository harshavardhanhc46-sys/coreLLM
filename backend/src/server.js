import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createId, readDb, touchNotebook, updateDb } from './db.js';
import { generateAssistantMessage } from './ai.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const uploadsDir = path.resolve(process.cwd(), 'uploads');

await fs.mkdir(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'corellm-backend' });
});

app.get('/api/notebooks', async (_req, res, next) => {
  try {
    const db = await readDb();
    res.json(db.notebooks);
  } catch (error) {
    next(error);
  }
});

app.post('/api/notebooks', async (req, res, next) => {
  try {
    const name = req.body?.name?.trim() || 'Untitled Notebook';
    const notebook = await updateDb((db) => {
      const nextNotebook = {
        id: createId('nb_'),
        name,
        sources: 0,
        lastUpdated: 'Just now',
        createdAt: new Date().toISOString()
      };
      db.notebooks.unshift(nextNotebook);
      db.messages[nextNotebook.id] = [];
      return nextNotebook;
    });

    res.status(201).json(notebook);
  } catch (error) {
    next(error);
  }
});

app.get('/api/notebooks/:notebookId', async (req, res, next) => {
  try {
    const db = await readDb();
    const notebook = db.notebooks.find((item) => item.id === req.params.notebookId);

    if (!notebook) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    res.json({
      ...notebook,
      sourceItems: db.sources.filter((source) => source.notebookId === notebook.id),
      messages: db.messages[notebook.id] || []
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/notebooks/:notebookId', async (req, res, next) => {
  try {
    const notebook = await updateDb((db) => {
      const found = db.notebooks.find((item) => item.id === req.params.notebookId);
      if (!found) return null;

      if (typeof req.body?.name === 'string' && req.body.name.trim()) {
        found.name = req.body.name.trim();
      }

      touchNotebook(found);
      return found;
    });

    if (!notebook) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    res.json(notebook);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/notebooks/:notebookId', async (req, res, next) => {
  try {
    const deleted = await updateDb((db) => {
      const index = db.notebooks.findIndex((item) => item.id === req.params.notebookId);
      if (index === -1) return false;

      db.notebooks.splice(index, 1);
      db.sources = db.sources.filter((source) => source.notebookId !== req.params.notebookId);
      delete db.messages[req.params.notebookId];
      return true;
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get('/api/notebooks/:notebookId/sources', async (req, res, next) => {
  try {
    const db = await readDb();
    res.json(db.sources.filter((source) => source.notebookId === req.params.notebookId));
  } catch (error) {
    next(error);
  }
});

app.post('/api/notebooks/:notebookId/sources', async (req, res, next) => {
  try {
    const { title, type = 'TEXT', content = '', url = '' } = req.body || {};

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Source title is required' });
    }

    const source = await updateDb((db) => {
      const notebook = db.notebooks.find((item) => item.id === req.params.notebookId);
      if (!notebook) return null;

      const nextSource = {
        id: createId('src_'),
        notebookId: notebook.id,
        title: title.trim(),
        type,
        status: type === 'YouTube' ? 'Transcribed' : type === 'URL' ? 'Scraped' : 'Indexed',
        content,
        url,
        createdAt: new Date().toISOString()
      };

      db.sources.push(nextSource);
      notebook.sources = db.sources.filter((item) => item.notebookId === notebook.id).length;
      touchNotebook(notebook);
      return nextSource;
    });

    if (!source) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    res.status(201).json(source);
  } catch (error) {
    next(error);
  }
});

app.post('/api/notebooks/:notebookId/sources/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const source = await updateDb((db) => {
      const notebook = db.notebooks.find((item) => item.id === req.params.notebookId);
      if (!notebook) return null;

      const nextSource = {
        id: createId('src_'),
        notebookId: notebook.id,
        title: req.body?.title?.trim() || req.file.originalname,
        type: req.body?.type || 'PDF',
        status: 'Indexed',
        content: req.body?.content || '',
        file: {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          path: req.file.path
        },
        createdAt: new Date().toISOString()
      };

      db.sources.push(nextSource);
      notebook.sources = db.sources.filter((item) => item.notebookId === notebook.id).length;
      touchNotebook(notebook);
      return nextSource;
    });

    if (!source) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: 'Notebook not found' });
    }

    res.status(201).json(source);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/notebooks/:notebookId/sources/:sourceId', async (req, res, next) => {
  try {
    const deleted = await updateDb((db) => {
      const index = db.sources.findIndex(
        (source) => source.id === req.params.sourceId && source.notebookId === req.params.notebookId
      );
      if (index === -1) return null;

      const [removed] = db.sources.splice(index, 1);
      const notebook = db.notebooks.find((item) => item.id === req.params.notebookId);
      if (notebook) {
        notebook.sources = db.sources.filter((source) => source.notebookId === notebook.id).length;
        touchNotebook(notebook);
      }
      return removed;
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Source not found' });
    }

    if (deleted.file?.path) {
      await fs.unlink(deleted.file.path).catch(() => {});
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get('/api/notebooks/:notebookId/messages', async (req, res, next) => {
  try {
    const db = await readDb();
    res.json(db.messages[req.params.notebookId] || []);
  } catch (error) {
    next(error);
  }
});

app.post('/api/notebooks/:notebookId/chat', async (req, res, next) => {
  try {
    const content = req.body?.message?.trim();
    const mode = req.body?.mode || 'standard';

    if (!content) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const db = await readDb();
    const notebook = db.notebooks.find((item) => item.id === req.params.notebookId);

    if (!notebook) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    const notebookSources = db.sources.filter((source) => source.notebookId === notebook.id);
    const userMessage = { id: createId('msg_'), role: 'user', content, createdAt: new Date().toISOString() };
    const assistantDraft = await generateAssistantMessage({ question: content, mode, sources: notebookSources });
    const assistantMessage = {
      id: createId('msg_'),
      ...assistantDraft,
      createdAt: new Date().toISOString()
    };

    await updateDb((currentDb) => {
      const currentNotebook = currentDb.notebooks.find((item) => item.id === req.params.notebookId);
      currentDb.messages[req.params.notebookId] = currentDb.messages[req.params.notebookId] || [];
      currentDb.messages[req.params.notebookId].push(userMessage, assistantMessage);
      if (currentNotebook) touchNotebook(currentNotebook);
      return null;
    });

    res.json({ userMessage, assistantMessage });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Unexpected server error' });
});

app.listen(port, () => {
  console.log(`CORELLM backend listening on http://localhost:${port}`);
});

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const seed = {
  notebooks: [
    { id: '1', name: 'Machine Learning Basics', sources: 3, lastUpdated: '2h ago', createdAt: new Date().toISOString() },
    { id: '2', name: 'Market Research 2024', sources: 5, lastUpdated: '1d ago', createdAt: new Date().toISOString() },
    { id: '3', name: 'Product Strategy PDF', sources: 1, lastUpdated: '3d ago', createdAt: new Date().toISOString() }
  ],
  sources: [
    { id: 's1', notebookId: '1', title: 'Attention is All You Need', type: 'PDF', status: 'Indexed', content: '', createdAt: new Date().toISOString() },
    { id: 's2', notebookId: '1', title: 'Tesla Q3 Earnings Call', type: 'YouTube', status: 'Transcribed', content: '', createdAt: new Date().toISOString() },
    { id: 's3', notebookId: '1', title: 'Next.js 14 Documentation', type: 'URL', status: 'Scraped', content: '', createdAt: new Date().toISOString() }
  ],
  messages: {}
};

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(seed, null, 2));
  }
}

export async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

export async function writeDb(db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

export async function updateDb(mutator) {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}

export function createId(prefix = '') {
  return `${prefix}${randomUUID()}`;
}

export function touchNotebook(notebook) {
  notebook.lastUpdated = 'Just now';
  notebook.updatedAt = new Date().toISOString();
}

# CORELLM Backend

Express backend for the CORELLM React notebook UI.

## Run

```bash
cd backend
npm install
npm run dev
```

The API starts on `http://localhost:4000`.

## Environment

Copy `.env.example` to `.env` if you want to change defaults.

`OPENAI_API_KEY` is optional. Without it, the chat endpoint returns a local placeholder response so the frontend can be built and tested immediately.

## API

- `GET /api/health`
- `GET /api/notebooks`
- `POST /api/notebooks` with `{ "name": "New Notebook" }`
- `GET /api/notebooks/:notebookId`
- `PATCH /api/notebooks/:notebookId` with `{ "name": "Updated Name" }`
- `DELETE /api/notebooks/:notebookId`
- `GET /api/notebooks/:notebookId/sources`
- `POST /api/notebooks/:notebookId/sources`
- `POST /api/notebooks/:notebookId/sources/upload` as multipart form data with `file`
- `DELETE /api/notebooks/:notebookId/sources/:sourceId`
- `GET /api/notebooks/:notebookId/messages`
- `POST /api/notebooks/:notebookId/chat` with `{ "message": "Explain this", "mode": "standard" }`

## Frontend Hook

Replace the UI mock state calls with requests to `http://localhost:4000/api`.

For example:

```js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function createNotebook(name = 'Untitled Notebook') {
  const res = await fetch(`${API_URL}/notebooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return res.json();
}

async function sendNotebookMessage(notebookId, message, mode) {
  const res = await fetch(`${API_URL}/notebooks/${notebookId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, mode })
  });
  return res.json();
}
```

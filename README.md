# G4LMS

G4LMS is a React/TypeScript LMS frontend with a Python/FastAPI backend. Neo4j
is the operational data store for accounts, courses, enrollments, coursework,
attendance, quizzes, messaging, and the learning knowledge graph.

## Local development

1. Copy `.env.example` to `.env`. Replace both placeholder secrets with unique
   random values; `JWT_SECRET_KEY` must be at least 32 characters.
2. Start the database from the repository root:

   ```powershell
   docker compose up -d neo4j
   ```

3. Install and start the API from `backend/`:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

   The API creates Neo4j constraints and indexes on startup. Create the first
   administrator interactively (password is prompted, not passed on the
   command line):

   ```powershell
   python -m app.cli create-admin --email admin@example.edu --name "LMS Admin"
   ```

4. In a second terminal, install and start the frontend from `frontend/`:

   ```powershell
   npm install
   Copy-Item .env.example .env
   # Set VITE_USE_MOCK_API=false in frontend/.env to use the API.
   npm run dev
   ```

   Vite proxies `/api` requests to `http://localhost:8000` by default. Change
   `VITE_BACKEND_URL` when the backend runs elsewhere. Mock mode remains
   enabled by default for isolated UI demos.

## Security and operations

- Never commit `.env`, passwords, JWT secrets, access tokens, or uploaded files.
- The backend stores password hashes (Argon2), revokes access tokens on logout
  and password changes, and checks role/course access on every protected
  operation.
- Uploaded binaries are stored under `backend/uploads/`; Neo4j stores their
  metadata. The development setup uses local disk; production should mount
  durable private storage and configure TLS and backups.
- `GET /health` checks the API-to-Neo4j connection. OpenAPI is available at
  `http://localhost:8000/docs` during local development.
- API payloads and endpoint permissions are documented in
  [docs/api/README.md](./docs/api/README.md).
# G4LMS Frontend

React 18, TypeScript, and Vite frontend for student and teacher LMS workflows.

## Run locally

```powershell
cd frontend
npm install
npm run dev
npm run build
```

By default, the UI uses fixtures and an in-memory mock API in the repository
root `mockdata/` folder. Choose **Học viên** or **Giảng viên** on the login
screen; the mock provider accepts an empty password.

To connect a backend, create `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:8000/api
VITE_USE_MOCK_API=false
```

See the [API contract](../docs/api/README.md) for routes, payloads, roles, and
error handling expected by the frontend. The backend route modules are not yet
implemented, so use mock mode until those endpoints are available.

## Structure

```text
mockdata/                     typed demo fixtures and mock API provider
frontend/src/api/client.ts    typed HTTP adapter; mock/real API switch
frontend/src/types/           shared frontend API/domain types
frontend/src/features/        auth, layout, graph, course and teacher UI
frontend/src/pages/           role-protected LMS pages
frontend/src/styles/          shared styles
docs/api/README.md            backend API contract
```

Student workflows include courses, course materials and announcements,
learning graphs, overall and per-course grades, assignment submissions, timed
quizzes, attendance history, and conversations. Teacher workflows include
course creation, course graphs, announcements, rosters, gradebook views,
assignment and quiz authoring, attendance management, file uploads, and
conversations. Mock uploads retain metadata only; file bytes require a backend.

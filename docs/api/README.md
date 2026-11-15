# G4LMS API contract

> **Audience:** backend engineers integrating the React frontend.
> **Contract version:** 1.2 · **Base path:** `/api` · **Payload format:** JSON except file uploads

This document is the frontend/backend agreement, not a claim that every route is
already implemented. The current backend route modules are scaffolds. The
frontend runs against the isolated repository-level `mockdata/` provider by
default; set `VITE_USE_MOCK_API=false` and `VITE_API_URL` to use a real API.

## Conventions

- Protected routes require `Authorization: Bearer <accessToken>`. The server
  derives the user, role, and tenant from the token; never trust a `role`,
  `userId`, or `tenantId` supplied as a query/body authorization control.
- IDs are opaque strings. Dates are ISO 8601 timestamps with timezone; the
  server stores timestamps in UTC and returns an explicit `Z` or offset.
- JSON request bodies use `Content-Type: application/json`; course-file uploads
  use `multipart/form-data` with a single `file` part. Let the browser provide
  the multipart boundary.
- List endpoints return JSON arrays directly in v1 because that is what the
  current client consumes. Keep course-scoped results bounded; a paged
  `{ items, nextCursor }` envelope requires a separately versioned client change.
- Successful creates return `201`; updates return `200`; deletes and
  acknowledge/read actions may return `204`.
- Errors use one shape at every status:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "The due date must be in the future.",
  "details": { "field": "dueAt" },
  "requestId": "req_01J..."
}
```

The frontend displays `message` and reads `code`; use `400` for invalid input,
`401` for missing/expired authentication, `403` for role/course access denial,
`404` for missing resources, `409` for state conflicts, and `500` for
unexpected server errors. Do not return an HTTP 200 response containing an
error.

## Authentication and account

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Sign in |
| `POST` | `/auth/refresh` | Refresh token | Rotate access token (contract-only; not called by current UI) |
| `POST` | `/auth/logout` | Signed in | Revoke refresh session (contract-only; UI currently clears local session) |
| `GET` | `/me/profile` | Signed in | Profile for the token's user |
| `PATCH` | `/me/profile` | Signed in | Update editable profile fields |

`POST /auth/login` request:

```json
{ "identity": "student@university.edu", "password": "••••••••" }
```

The role is resolved by the server, not selected as a trusted client claim.
Response:

```json
{
  "accessToken": "<opaque-or-jwt>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "usr_123", "name": "Nguyen Anh", "initials": "NA",
    "email": "student@university.edu", "role": "student"
  }
}
```

The frontend maps the returned `user` and `accessToken` into its signed-in
session. `GET /me/profile` returns the profile-details object consumed by the
profile page, without a nested user wrapper:

```json
{
  "id": "2252001",
  "fieldVi": "Khoa học Máy tính",
  "fieldEn": "Computer Science",
  "labelVi": "Ngành",
  "labelEn": "Major",
  "extra": "2022-2026"
}
```

Here `id` is the role-specific student/staff identifier displayed on the
profile; the account's opaque user ID is the separate `user.id` returned at
login. `PATCH /me/profile` is contract-only and is not currently called by the
UI. Agree on its editable request fields before implementation; the server
must reject attempts to change account ID, role, enrollment, or faculty
ownership. Roles are `student` and `teacher`; administrators should be added
as a separate role before exposing administrative UI.

`/auth/refresh` and `/auth/logout` are contract extensions; the current
frontend session provider only calls `/auth/login`. Refresh tokens should be
rotated/revoked server-side and must not be stored in frontend local storage.

## Home, dashboard, and communication

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/home/slides` | Public | Home carousel content |
| `GET` | `/home/login-stats` | Public | Login hero statistics |
| `GET` | `/dashboard` | Signed in | Timeline and calendar events visible to current user |
| `GET` | `/notifications` | Signed in | Current user's notifications |
| `POST` | `/notifications/read-all` | Signed in | Mark current user's notifications read |
| `GET` | `/messages` | Signed in | Current user's conversation previews |
| `GET` | `/conversations` | Signed in | Current user's conversation list |
| `GET` | `/conversations/contacts` | Signed in | Eligible recipients for a new conversation |
| `POST` | `/conversations` | Signed in | Start a conversation and send its first message |
| `GET` | `/conversations/{conversationId}/messages` | Participant | Read a conversation thread |
| `POST` | `/conversations/{conversationId}/messages` | Participant | Send a message |
| `PATCH` | `/conversations/{conversationId}/read` | Participant | Mark the current user's thread read |
| `GET` | `/student/courses/{courseId}/announcements` | Enrolled student | Published course announcements |
| `GET` | `/teacher/courses/{courseId}/announcements` | Course teacher | Course announcements including drafts |
| `POST` | `/teacher/courses/{courseId}/announcements` | Course teacher | Create an announcement draft |
| `PATCH` | `/teacher/courses/{courseId}/announcements/{announcementId}` | Course teacher | Publish or unpublish an announcement |

The dashboard response contains two arrays:

```json
{
  "activities": [{
    "id": "act_1", "dueAt": "2026-11-30T16:59:00Z",
    "title": "TCP report", "courseId": "course_123", "courseCode": "CO3093",
    "description": "Submit the report.", "type": "assignment",
    "targetId": "assignment_123"
  }],
  "calendarEvents": [{
    "id": "evt_1", "date": "2026-11-30", "title": "TCP report due",
    "type": "warning", "courseCode": "CO3093"
  }]
}
```

Allowed `activities[].type`: `survey`, `assignment`, `quiz`, `class`. Allowed
`calendarEvents[].type`: `warning`, `info`, `success`. Dashboard results must be
scoped to the authenticated user and courses they can access. `targetId` is
optional and identifies the assignment or quiz for actionable activities; it
is omitted when the activity has no detail route.

`GET /home/slides` returns rows with `id`, `titleVi`, `titleEn`, `subtitleVi`,
`subtitleEn`, `linkVi`, `linkEn`, and `imageUrl`. `GET /home/login-stats`
returns rows with `value`, `labelVi`, and `labelEn`. These two endpoints are
public and provide presentation content only; they must not contain
personalized account data.

Course announcement fields are `id`, `courseId`, `title`, `body`, `status`,
`createdAt`, and optional `publishedAt`. Status is `draft` or `published`.
Students see published announcements only; teacher create requests return a
draft until explicitly published. Create request is `{ "title": "...",
"body": "..." }`; status updates use `{ "status": "published" }` or
`{ "status": "draft" }` and return the updated announcement.

`GET /notifications` returns rows with `id`, `title`, `description`, `time`,
and `read`. `POST /notifications/read-all` updates only the current user's
notifications and may return `204`.

The legacy `GET /messages` endpoint returns preview rows with `id`, `initials`,
`sender`, `time`, `preview`, and `unread`. The full inbox uses `GET
/conversations`, whose rows contain `id`, `participantId`, `participantName`,
`initials`, optional `courseCode`, `lastMessage`, `lastMessageAt`, and
`unreadCount`. Contacts contain `id`, `name`, `initials`, `role`, and optional
`courseCode`; return only recipients the current user is allowed to contact.

`POST /conversations` request:

```json
{ "recipientId": "usr_456", "message": "Could you clarify question 2?" }
```

Return the created conversation summary with `201`. Thread messages contain
`id`, `conversationId`, `senderId`, `senderName`, `body`, and `sentAt`.
`POST /conversations/{conversationId}/messages` accepts `{ "body": "..." }`
and returns the created message. Message bodies must be non-empty after
trimming and at most 4,000 characters, matching the current UI. `PATCH
/conversations/{conversationId}/read` marks the current user's unread messages
as read and may return `204`.
Validate conversation membership on every operation; do not rely on the client
to enforce participant or course access.

## Courses and content

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/student/courses` | Student | Enrolled courses and personal progress |
| `GET` | `/teacher/courses` | Teacher | Courses owned/assigned to teacher |
| `POST` | `/teacher/courses` | Teacher | Create course |
| `GET` | `/courses/{courseId}/sections` | Enrolled student or course teacher | Sections and learning resources |
| `GET` | `/teacher/courses/{courseId}/topics` | Course teacher | Teacher course outline |

Create course request:

```json
{ "code": "CO3093", "title": "Computer Networks", "faculty": "Computer Science" }
```

`POST /teacher/courses` returns the created teacher-course object with `201`.
The server assigns `id`, initializes course graph counts, and derives teacher
ownership from the authenticated user; do not accept ownership from the body.

Course list response fields:

```json
{
  "id": "course_123",
  "code": "CO3093",
  "title": "Computer Networks",
  "faculty": "Computer Science",
  "theme": "blue",
  "lecturer": "Nguyen Van Hung",
  "progress": 35,
  "gap": "TCP congestion control",
  "deadline": "Report due Nov 30",
  "students": 56,
  "pending": 4,
  "published": true,
  "nodesWithContent": 86,
  "totalNodes": 112
}
```

Fields specific to student or teacher cards may be omitted when they do not
apply. `progress` is `0..100`; `theme` is a presentation hint (`blue`,
`green`, `orange`, `slate`).

Section response:

```json
[{
  "id": "section_1",
  "titleVi": "Chương 1",
  "titleEn": "Chapter 1",
  "items": [{
    "id": "resource_1", "nameVi": "Slide bài giảng",
    "nameEn": "Lecture slides", "kind": "slides",
    "url": "https://files.example.edu/resource_1"
  }]
}]
```

Allowed resource `kind`: `pdf`, `slides`, `video`, `quiz`. Use an authorized,
short-lived download URL for protected files; do not expose storage credentials.
For `kind: "quiz"`, the resource `id` is the quiz ID used by the quiz detail and
attempt routes; it must reference a quiz in the same course. `url` is optional
and is only used for downloadable/viewable resources.

## Assignments and submissions

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/student/courses/{courseId}/assignments` | Enrolled student | Published work and that student's submission state |
| `GET` | `/teacher/courses/{courseId}/assignments` | Course teacher | All assignments, including drafts |
| `POST` | `/teacher/courses/{courseId}/assignments` | Course teacher | Create a draft |
| `PATCH` | `/teacher/courses/{courseId}/assignments/{assignmentId}` | Course teacher | Publish, close, or reopen |
| `POST` | `/student/courses/{courseId}/assignments/{assignmentId}/submissions` | Enrolled student | Submit or replace work |
| `GET` | `/teacher/courses/{courseId}/assignments/{assignmentId}/submissions` | Course teacher | Review submissions (contract-only; no current UI) |
| `PATCH` | `/teacher/courses/{courseId}/assignments/{assignmentId}/submissions/{submissionId}` | Course teacher | Grade and give feedback (contract-only; no current UI) |

Create request:

```json
{
  "title": "TCP report",
  "description": "Analyze a TCP session and submit a report.",
  "dueAt": "2026-11-30T16:59:00Z",
  "maxScore": 10
}
```

Assignment response:

```json
{
  "id": "assignment_123",
  "courseId": "course_123",
  "title": "TCP report",
  "description": "Analyze a TCP session and submit a report.",
  "dueAt": "2026-11-30T16:59:00Z",
  "maxScore": 10,
  "status": "published",
  "submissionStatus": "not_submitted",
  "submittedAt": null,
  "score": null,
  "feedback": null
}
```

Assignment `status`: `draft`, `published`, `closed`. Student submission
`submissionStatus`: `not_submitted`, `submitted`, `graded`, `late`. The UI
accepts maximum scores from `0.5` through `1000` in `0.5` increments. A
submission request is currently text-only:

```json
{ "text": "My analysis and conclusions..." }
```

New assignments start as `draft`. The assignment status update body is
`{ "status": "published" }` or `{ "status": "closed" }`; valid transitions are
`draft -> published -> closed -> published`. Student assignment rows may
include `submissionText`; teacher assignment lists must not expose a student's
private submission text. A submission request returns the updated assignment
state for that student, including `submissionStatus`, `submittedAt`, and their
own `submissionText`.

Use the assignment response's submission state for the current student; never
return other students' work from the student endpoint. Reject submissions to
draft/closed assignments. The server is authoritative for deadline/late status,
score bounds, and whether replacement submissions are permitted. File upload
should be a separate signed-upload flow (`POST .../upload-url`, object upload,
then submission with the resulting `fileId`) before the UI adds attachments.

The grading routes above are specified for future backend/UI integration.
`GET .../submissions` returns an array of `{ id, studentId, studentName,
text, submittedAt, status, score, feedback }`; `PATCH
.../submissions/{submissionId}` accepts `{ "score": 8.5, "feedback":
"Good analysis." }` and returns the updated row. Validate `0 <= score <=
maxScore`, preserve the submission audit history, and make grade visibility
follow the course's release policy.

## Grades and roster

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/student/grades` | Student | Overall final grades across all terms/courses |
| `GET` | `/student/courses/{courseId}/grades` | Enrolled student | The student's grade items |
| `GET` | `/teacher/courses/{courseId}/students` | Course teacher | Course roster |
| `GET` | `/teacher/courses/{courseId}/gradebook` | Course teacher | Roster with grade columns and calculated total |

Student grade item:

```json
{
  "id": "grade_midterm",
  "category": "manual",
  "titleVi": "Giữa kỳ",
  "titleEn": "Midterm",
  "score": 9,
  "maxScore": 10,
  "weight": 0.3,
  "feedback": null
}
```

Roster items contain `id`, `name`, `status` (`active` or `withdrawn`) and
`progress` (`0..100`). Gradebook rows add nullable `midterm`, `project`,
`final`, `attendance`, and server-calculated `totalScore`. A missing/unreleased
score is `null`, not zero. The server owns grade weighting and total
calculation; the frontend displays the returned total.

The global student grade overview returns one row per course/term:

```json
[{
  "courseId": "course_123",
  "courseCode": "CO3093",
  "courseTitle": "Computer Networks",
  "term": "HK261",
  "credits": 3,
  "finalScore": 8.2,
  "maxScore": 10,
  "letterGrade": "B+",
  "status": "published"
}]
```

`finalScore` and `letterGrade` are `null` until released. `status` is
`published`, `in_progress`, or `incomplete`. This endpoint powers the separate
**Course grades overview** page reached from the profile dropdown; it is not
the grade tab for an individual course.

## Quizzes

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/student/courses/{courseId}/quizzes` | Enrolled student | Published quizzes only |
| `GET` | `/teacher/courses/{courseId}/quizzes` | Course teacher | Quizzes including drafts and closed items |
| `POST` | `/teacher/courses/{courseId}/quizzes` | Course teacher | Create a draft quiz and answer key |
| `PATCH` | `/teacher/courses/{courseId}/quizzes/{quizId}` | Course teacher | Publish, close, or reopen a quiz |
| `GET` | `/student/courses/{courseId}/quizzes/{quizId}` | Enrolled student | Quiz metadata and answer options (never the answer key) |
| `POST` | `/student/courses/{courseId}/quizzes/{quizId}/attempts` | Enrolled student | Start a timed attempt |
| `POST` | `/student/courses/{courseId}/quizzes/{quizId}/attempts/{attemptId}/submit` | Attempt owner | Submit answers; server scores the attempt |

Quiz response:

```json
{
  "id": "quiz_123",
  "courseId": "course_123",
  "title": "Transport layer check",
  "description": "Check your understanding of TCP and UDP.",
  "timeLimitMinutes": 10,
  "attemptsAllowed": 2,
  "attemptsUsed": 0,
  "status": "published",
  "questions": [{
    "id": "question_1",
    "prompt": "Which protocol provides reliable ordered delivery?",
    "options": [
      { "id": "a", "text": "UDP" },
      { "id": "b", "text": "TCP" }
    ]
  }]
}
```

`attemptsUsed` is per authenticated student, not a course-wide count. Teacher
responses can include answer keys; never expose keys in any student endpoint.
The current quiz authoring UI accepts a time limit of `1..300` minutes, an
attempt limit of `1..20`, and exactly four non-empty options per question.
Question IDs and option IDs must be unique within the quiz; `correctOptionId`
must refer to one of that question's options. Trim whitespace before required
field validation.

Starting an attempt returns `id`, `quizId`, `startedAt`, `expiresAt`,
`maxScore`, and `totalQuestions`. Submit request:

```json
{ "answers": { "question_1": "b" } }
```

The submitted attempt response adds `submittedAt`, `score`, and
`correctCount`. The server validates attempt ownership, allowed attempt count,
quiz availability, deadline, and answer IDs. It must not include correct
answers in the quiz or attempt response.

Teacher create request:

```json
{
  "title": "Transport layer check",
  "description": "Check understanding of TCP and UDP.",
  "timeLimitMinutes": 10,
  "attemptsAllowed": 2,
  "questions": [{
    "id": "question_1",
    "prompt": "Which protocol provides reliable ordered delivery?",
    "options": [
      { "id": "a", "text": "UDP" },
      { "id": "b", "text": "TCP" }
    ],
    "correctOptionId": "b"
  }]
}
```

New quizzes start as `draft`. The teacher list may include `correctOptionId`
only for the course teacher; student list/detail responses must remove it and
any equivalent answer-key field. The `PATCH` body is `{ "status": "published" }`,
`{ "status": "closed" }`, or a valid reopen transition. Reject empty quizzes,
invalid option references, and publishing a quiz with no valid questions. The
student list and detail must use the same availability rules.

## Attendance

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/student/courses/{courseId}/attendance` | Enrolled student | Published attendance and the current student's summary |
| `GET` | `/teacher/courses/{courseId}/attendance` | Course teacher | Course sessions with each student's status |
| `POST` | `/teacher/courses/{courseId}/attendance/sessions` | Course teacher | Create a draft session and an unmarked course roster |
| `PATCH` | `/teacher/courses/{courseId}/attendance/sessions/{sessionId}` | Course teacher | Save statuses and publish a session |

The student endpoint returns:

```json
{
  "totalSessions": 2,
  "present": 1,
  "absent": 0,
  "late": 1,
  "excused": 0,
  "attendanceRate": 100,
  "records": [{
    "sessionId": "att_123",
    "title": "Transport layer",
    "date": "2026-11-14",
    "status": "late"
  }]
}
```

Teacher session rows contain `id`, `courseId`, `title`, `date` (`YYYY-MM-DD`),
`status` (`draft` or `published`), and `records`. Each record contains
`studentId`, `name`, `status` (`unmarked`, `present`, `absent`, `late`, or
`excused`), and optional `note`. Creating a session initializes every enrolled
student as `unmarked`; it must not silently mark students absent. Create body:
`{ "title": "Transport layer", "date": "2026-11-14" }`.

The update body contains the complete roster snapshot and desired session
status:

```json
{
  "status": "published",
  "records": [
    { "studentId": "usr_123", "name": "Nguyen Anh", "status": "present" },
    { "studentId": "usr_456", "name": "Tran Binh", "status": "excused", "note": "Approved absence" }
  ]
}
```

The server validates that each enrolled student appears exactly once, rejects
unknown/duplicate student IDs, and does not publish while any record is
`unmarked`. Students must see only their own row from published sessions.
`attendanceRate` is rounded to an integer and uses
`(present + late + excused) / published sessions`; excused absences therefore
do not lower the rate. Return `0` when there are no published sessions. Draft
sessions and other students' records must never appear in a student response.

On attendance updates, `studentId` and `status` are authoritative inputs;
`name` is display-only and must be resolved from the enrolled roster on the
server. Do not trust a client-supplied name when storing or returning attendance.

## Course file upload

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/teacher/courses/{courseId}/documents` | Course teacher | List course files for management and graph generation |
| `POST` | `/teacher/courses/{courseId}/documents` | Course teacher | Upload one course file |

Upload one `file` part using `multipart/form-data`. Current UI allows PDF,
DOC/DOCX, PPT/PPTX, MP4/MOV, and ZIP files up to 50 MiB; the server must
validate actual content type, size, file signature, course authorization, and
malware policy independently. Never trust the filename or browser-supplied
MIME type. Store files outside the web root and return a short-lived,
course-authorized `downloadUrl` (or omit it when download is not enabled).

List and upload responses use:

```json
{
  "id": "file_123",
  "courseId": "course_123",
  "name": "transport-slides.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 2048000,
  "uploadedAt": "2026-11-15T08:30:00Z",
  "downloadUrl": "https://files.example.edu/signed/..."
}
```

Every PDF entry must also include `pages` (positive integer), `sizeMb`
(number), and `date` (`YYYY-MM-DD`) because the current teacher graph document
picker consumes those fields. Return `413` for an oversized payload, `415` for
a disallowed/invalid file type, and the standard error shape for other
failures. The mock provider stores metadata only; it does not persist file
bytes.

## Knowledge graph and learning outcomes

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/student/courses/{courseId}/graph[?cluster_id=...]` | Enrolled student | Personalized knowledge graph |
| `GET` | `/student/courses/{courseId}/learning-outcomes` | Enrolled student | Learning outcomes and progress |
| `GET` | `/student/nodes/{nodeId}` | Enrolled student | Node mastery, prerequisites, and guidance |
| `GET` | `/teacher/courses/{courseId}/graph` | Course teacher | Course graph overview |
| `GET` | `/teacher/clusters/{clusterId}` | Course teacher | Cluster nodes and edges |
| `GET` | `/teacher/courses/{courseId}/review-queue` | Course teacher | Graph/content review queue |
| `GET` | `/teacher/analytics/heatmap[?cluster_id=...]` | Course teacher | Learner struggle summary |
| `GET` | `/teacher/courses/{courseId}/learning-outcomes/chains` | Course teacher | LO-to-node chains |
| `GET` | `/teacher/nodes/{nodeId}` | Course teacher | Node editing data |

Student graph:

```json
{
  "nodes": [{
    "id": "node_1", "label": "TCP", "x": 180, "y": 120,
    "status": "progress", "mastery": 62, "lo": "LO3.1"
  }],
  "edges": [{ "from": "node_0", "to": "node_1", "kind": "prereq" }]
}
```

Allowed node `status`: `mastered`, `review`, `locked`, `available`, `progress`.
Allowed edge `kind`: `prereq`, `related`, `concept`. Keep graph coordinates
stable per response and ensure every edge references a returned node.

### Learning outcomes and teacher graph responses

`GET /student/courses/{courseId}/learning-outcomes` returns an array of
`{ id, title, done, total, percent }`; `percent` is `0..100`. The student node
detail endpoint returns:

```json
{
  "id": "node_1",
  "title": "TCP congestion control",
  "course": "CO3093",
  "cluster": "Transport layer",
  "statusLabel": "In progress",
  "status": "progress",
  "mastery": 62,
  "lo": "LO3.1",
  "prerequisites": [
    { "title": "Reliable transport", "state": "Mastered", "done": true }
  ],
  "aiHint": "Review the congestion window transition.",
  "cta": "Continue learning"
}
```

`GET /teacher/courses/{courseId}/graph` returns `{ stats, clusters,
clusterEdges }`. `stats` contains `nodes`, `edges`, and `drafts`. Each cluster
contains `id`, `index`, `name`, `nodeCount`, coordinates `x` and `y`, `lo`
(learning-outcome IDs), `struggle` (percentage), `approved`, and optional
`issue: { label, level }`, where `level` is `warn` or `error`.
`GET /teacher/clusters/{clusterId}` returns `{ nodes, edges }`; node rows
contain `id`, `name`, `status`, coordinates, optional `ghost`/`ghostFrom`,
learning-outcome IDs, and incoming/outgoing/content/question counts. Teacher
node statuses are `approved`, `draft`, `pending_review`, or `outside_cluster`.
The UI localizes these stable values; never send translated labels as enum
values. Node-editor content and question statuses are `approved` or `draft`.

`GET /teacher/courses/{courseId}/review-queue` returns
`{ total, pending, missingTest, cycleWarn, noLo, items }`. Each item contains
`id`, `title`, `cluster`, `tag`, and `severity` (`error`, `warn`, `info`, or
`ai`). `GET /teacher/analytics/heatmap` returns `{ cluster, node, struggling,
total, students }`; each student has `initials`, `name`, `meta`, and `percent`.
An optional `cluster_id` query filters the heatmap.

`GET /teacher/courses/{courseId}/learning-outcomes/chains` returns rows with
`lo`, `title`, `steps` (ordered node labels), and `end`. Course topics at
`GET /teacher/courses/{courseId}/topics` are rows with `id`, `number`,
`titleVi`, `titleEn`, and `resources`.
`GET /teacher/nodes/{nodeId}` returns editor data with `id`, `name`, `course`,
`group`, `parentNode`, `cluster`, `description`, `prerequisites`,
`contents`, and `questions`. Content rows have `id`, `kind` (`Definition` or
`Example`), `status`, `title`, and `source`; question rows have `id`, `text`,
`bloom`, `difficulty`, and `status`. These are read endpoints; node/graph
editing mutations are not part of the current frontend contract.

## Future contract work outside the current UI

These are not yet interactive frontend workflows and should be treated as
future work rather than implemented UI:

| Module | Suggested endpoints |
|---|---|
| Calendar events | `GET/POST /calendar/events`, `PATCH/DELETE /calendar/events/{eventId}` |
| Assignment grading UI/release | The submission list and grade-update routes are specified above but are not called by current frontend code; student grade release and its UI remain future work |
| Quiz editing | Update quiz metadata/questions and delete/archive a quiz |
| Quiz attempt recovery/history | Add a way to resume an in-progress attempt after reload and retrieve prior attempts/results, if those behaviors are required |
| File lifecycle | Delete/replace course files and attach uploaded files to assignments |
| LMS administration | Course enrollment, term management, roles, and audit history |
| Knowledge graph authoring | Persist graph generation jobs/results, node/edge edits, cluster approval, and learning-outcome mapping; current teacher graph UI uses local state for these actions |
| Account and notifications | Define password recovery, profile-update fields, and per-notification read state before adding those UI workflows |
| Large-list pagination | Add cursor/filter contracts for course rosters, inboxes, and notifications when they exceed practical bounded response sizes; current v1 client expects direct arrays |

Quiz attempts must persist and enforce attempt count, open/close window,
server-side scoring, and answer visibility rules. Announcements, attendance,
messages, calendar events, grades, and files must be scoped to the course and
authorized role.

## Frontend integration checklist

1. Implement the routes in the tables above under the configured API prefix.
2. Return the documented property names and enum values; preserve `null` for
   unreleased grade fields.
3. Enforce role, tenant, enrollment, ownership, and deadline rules on the
   server—not only in the UI.
4. Add integration tests for access denial, draft visibility, assignment
   submission deadlines, grade privacy, quiz answer secrecy, attendance
   scoping, and upload validation.
5. Set `VITE_API_URL` and `VITE_USE_MOCK_API=false`, then verify login, course
   list, graph, grades, roster, assignment creation/publication/submission, and
   notifications, quiz authoring/attempts, uploads, attendance, and messaging
   against the backend.
export type Role = 'student' | 'teacher' | 'admin';

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  accessToken?: string;
  passwordResetRequired?: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  active: boolean;
}

export interface AdminStudentOption {
  id: string;
  name: string;
  email: string;
}

export interface AdminCourseOption {
  id: string;
  code: string;
  title: string;
  semester: string;
  year: number;
}

export interface AdminEnrollment {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  enrolledAt: string;
  progress: number;
}

export interface AdminStats {
  students: number;
  teachers: number;
  admins: number;
  courses: number;
  enrollments: number;
  assignments: number;
  announcements: number;
  teachersList: { id: string; name: string; email: string }[];
}

export interface AdminCourseRecord {
  id: string;
  code: string;
  title: string;
  description: string;
  faculty: string;
  semester: string;
  year: number;
  theme: CourseTheme;
  published: boolean;
  lecturerId?: string | null;
  lecturerName?: string;
  students: number;
  createdAt?: string;
}

export interface AdminAnnouncementRecord {
  id: string;
  courseId: string | null;
  courseName: string;
  title: string;
  body: string;
  status: 'draft' | 'published';
  isGlobal: boolean;
  authorName: string;
  createdAt: string;
  publishedAt?: string | null;
}


export interface ProfileRecord {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  dateOfBirth: string | null;
  studentCode?: string | null;
  staffCode?: string | null;
  faculty?: string | null;
  classYear?: string | null;
  title?: string | null;
}

export interface DashboardActivity {
  id: string;
  dueAt: string;
  title: string;
  courseId: string;
  courseCode: string;
  description: string;
  type: 'survey' | 'assignment' | 'quiz' | 'class';
  targetId?: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'warning' | 'info' | 'success';
  courseCode: string;
}

export interface DashboardData {
  activities: DashboardActivity[];
  calendarEvents: CalendarEvent[];
}

export interface CourseResource {
  id: string;
  nameVi: string;
  nameEn: string;
  kind: 'pdf' | 'slides' | 'video' | 'quiz';
  url?: string;
}

export interface CourseSection {
  id: string;
  titleVi: string;
  titleEn: string;
  items: CourseResource[];
}

export interface StudentGradeItem {
  id: string;
  category: 'manual' | 'attendance';
  titleVi: string;
  titleEn: string;
  score: number | null;
  maxScore: number;
  weight: number | null;
  feedback: string | null;
}

export interface CourseOverallGrade {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  term: string;
  credits: number;
  finalScore: number | null;
  maxScore: number;
  letterGrade: string | null;
  status: 'in_progress' | 'published' | 'incomplete';
}

export interface RosterStudent {
  id: string;
  name: string;
  email?: string;
  enrolledAt?: string;
  status: 'active' | 'withdrawn';
  progress: number;
}

export interface TeacherGradeRow extends RosterStudent {
  midterm: number | null;
  project: number | null;
  final: number | null;
  attendance: number | null;
  totalScore: number | null;
}

export interface UpdateGradebookRowInput {
  midterm: number | null;
  project: number | null;
  final: number | null;
  attendance: number | null;
}

export type AssignmentStatus = 'draft' | 'published' | 'closed';
export type SubmissionStatus = 'not_submitted' | 'submitted' | 'graded' | 'late';

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueAt: string;
  maxScore: number;
  status: AssignmentStatus;
  submissionStatus?: SubmissionStatus;
  submittedAt?: string;
  score?: number | null;
  feedback?: string | null;
  submissionText?: string;
  submissionCount?: number;
  gradedCount?: number;
}

export interface AssignmentSubmissionRecord {
  id: string;
  studentId: string;
  studentName: string;
  text: string;
  submittedAt: string;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
}


export type AttendanceStatus = 'unmarked' | 'present' | 'absent' | 'late' | 'excused';
export type AttendanceSessionStatus = 'draft' | 'published';

export interface AttendanceEntry {
  studentId: string;
  name: string;
  status: AttendanceStatus;
  note?: string;
}

export interface AttendanceSession {
  id: string;
  courseId: string;
  title: string;
  date: string;
  status: AttendanceSessionStatus;
  records: AttendanceEntry[];
}

export interface StudentAttendanceRecord {
  sessionId: string;
  title: string;
  date: string;
  status: Exclude<AttendanceStatus, 'unmarked'>;
}

export interface StudentAttendanceData {
  totalSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
  records: StudentAttendanceRecord[];
}

export interface CreateAttendanceSessionInput {
  title: string;
  date: string;
}

export interface UpdateAttendanceSessionInput {
  records: AttendanceEntry[];
  status: AttendanceSessionStatus;
}

export interface Announcement {
  id: string;
  courseId: string;
  title: string;
  body: string;
  status: 'draft' | 'published';
  isGlobal?: boolean;
  authorName?: string;
  courseName?: string;
  createdAt: string;
  publishedAt?: string;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  status?: 'draft' | 'published';
}

export interface CreateAssignmentInput {
  title: string;
  description: string;
  dueAt: string;
  maxScore: number;
}

export interface UpdateAssignmentInput {
  title?: string;
  description?: string;
  dueAt?: string;
  maxScore?: number;
  status?: AssignmentStatus;
}

export interface SubmitAssignmentInput {
  text: string;
}


export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
}

export type QuizStatus = 'draft' | 'published' | 'closed';

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string;
  timeLimitMinutes: number;
  attemptsAllowed: number;
  attemptsUsed: number;
  status: QuizStatus;
  questions: QuizQuestion[];
}

export interface CreateQuizQuestionInput extends QuizQuestion {
  correctOptionId: string;
}

export interface CreateQuizInput {
  title: string;
  description: string;
  timeLimitMinutes: number;
  attemptsAllowed: number;
  questions: CreateQuizQuestionInput[];
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  score?: number;
  maxScore: number;
  correctCount?: number;
  totalQuestions: number;
}

export interface SubmitQuizInput {
  answers: Record<string, string>;
}

export interface HomeSlide {
  id: string;
  titleVi: string;
  titleEn: string;
  subtitleVi: string;
  subtitleEn: string;
  linkVi: string;
  linkEn: string;
  imageUrl: string;
}

export interface LoginHeroStat {
  value: string;
  labelVi: string;
  labelEn: string;
}

export interface ProfileDetails {
  id: string;
  fieldVi: string;
  fieldEn: string;
  labelVi: string;
  labelEn: string;
  extra: string;
}

export interface NotificationRecord {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export interface MessagePreview {
  id: string;
  initials: string;
  sender: string;
  time: string;
  preview: string;
  unread: boolean;
}

export interface ConversationSummary {
  id: string;
  participantId: string;
  participantName: string;
  initials: string;
  courseCode?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  sentAt: string;
}

export interface MessageContact {
  id: string;
  name: string;
  initials: string;
  role: Role;
  courseCode?: string;
}

export interface CreateConversationInput {
  recipientId: string;
  message: string;
}

export interface CourseFile {
  id: string;
  courseId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  downloadUrl?: string;
}

export interface PdfFile extends CourseFile {
  pages: number;
  sizeMb: number;
  date: string;
}

export interface TeacherCourseTopic {
  id: string;
  number: string;
  titleVi: string;
  titleEn: string;
  resources: string[];
}

export type CourseTheme = 'blue' | 'green' | 'orange' | 'slate';

export interface StudentCourse {
  id: string;
  code: string;
  title: string;
  description?: string;
  faculty: string;
  semester?: string;
  year?: number;
  lecturer: string;
  progress: number;
  gap: string;
  deadline: string;
  theme: CourseTheme;
}

export interface TeacherCourse {
  id: string;
  code: string;
  title: string;
  description?: string;
  faculty: string;
  semester?: string;
  year?: number;
  students: number;
  pending?: number;
  published: boolean;
  nodesWithContent: number;
  totalNodes: number;
  theme: CourseTheme;
}

export interface CreateTeacherCourseInput {
  code: string;
  title: string;
  description?: string;
  faculty: string;
  semester?: string;
  year?: number;
  theme?: CourseTheme;
}

export interface UpdateTeacherCourseInput {
  code?: string;
  title?: string;
  description?: string;
  faculty?: string;
  semester?: string;
  year?: number;
  theme?: CourseTheme;
  published?: boolean;
  lecturerId?: string | null;
}

export interface StudentLearningProfile {
  studentId: string;
  overallProgress: number;
  courses: {
    courseId: string;
    courseCode: string;
    courseTitle: string;
    progress: number;
    gap: string;
    totalNodes: number;
    masteredNodes: number;
    inProgressNodes: number;
    averageMastery: number;
  }[];
  knowledgeGaps: {
    id: string;
    title: string;
    courseId: string;
    courseCode: string;
    cluster: string;
    mastery: number;
    lo: string;
  }[];
}

export interface CourseRecommendation {
  nodeId: string;
  title: string;
  subtitle?: string;
  clusterName?: string;
  learningOutcomeId?: string;
  currentMastery: number;
  aiHint?: string;
  score: number;
  reason: string;
  prerequisites?: { id: string; title: string; mastery: number; ready: boolean }[];
}


export interface LearningOutcome {
  id: string; // LO1
  title: string;
  done: number;
  total: number;
  percent: number;
}

export type NodeStatus = 'mastered' | 'review' | 'locked' | 'available' | 'progress';
export type EdgeKind = 'prereq' | 'related' | 'concept';

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

/** Node trong đồ thị phía học viên. */
export interface StudentNode {
  id: string;
  label: string;
  sub?: string;
  x: number;
  y: number;
  status: NodeStatus;
  mastery?: number; // 0..100
  lo?: string;
  tag?: string; // nhãn nhỏ phía trên
  drillable?: boolean;
}

export interface StudentGraph {
  nodes: StudentNode[];
  edges: GraphEdge[];
  nextReview?: { title: string; cluster: string; mastery: number };
}

export interface NodeDetail {
  id: string;
  title: string;
  course: string;
  cluster: string;
  statusLabel: string;
  status: NodeStatus;
  mastery: number;
  lo: string;
  prerequisites: { title: string; state: string; done: boolean }[];
  aiHint?: string;
  cta: string;
}

/** Cụm kiến thức (cấp tổng quan) phía giảng viên. */
export interface TeacherCluster {
  id: string;
  index: number;
  name: string;
  nodeCount: number;
  x: number;
  y: number;
  lo: string[];
  issue?: { label: string; level: 'warn' | 'error' };
  struggle: number; // % học viên gặp khó khăn
  approved: boolean;
}

export interface TeacherNode {
  id: string;
  name: string;
  status: 'approved' | 'draft' | 'pending_review' | 'outside_cluster';
  x: number;
  y: number;
  ghost?: boolean;
  ghostFrom?: string;
  lo?: string[];
  incoming?: number;
  outgoing?: number;
  contents?: number;
  questions?: number;
}

export interface TeacherGraphData {
  clusters: TeacherCluster[];
  clusterEdges: GraphEdge[];
  stats: { nodes: number; edges: number; drafts: number };
}

export interface ClusterView {
  nodes: TeacherNode[];
  edges: GraphEdge[];
}

export type QueueSeverity = 'error' | 'warn' | 'info' | 'ai';

export interface QueueItem {
  id: string;
  title: string;
  cluster: string;
  tag: string;
  severity: QueueSeverity;
}

export interface QueueSummary {
  total: number;
  pending: number;
  missingTest: number;
  cycleWarn: number;
  noLo: number;
  items: QueueItem[];
}

export interface HeatStudent {
  initials: string;
  name: string;
  meta: string;
  percent: number;
}

export interface HeatSpot {
  cluster: string;
  node: string;
  struggling: number;
  total: number;
  students: HeatStudent[];
}

export interface ContentItem {
  id: string;
  kind: 'Definition' | 'Example';
  status: 'approved' | 'draft';
  title: string;
  source: string;
}

export interface QuestionItem {
  id: string;
  text: string;
  bloom: string;
  difficulty: string;
  status: 'approved' | 'draft';
}

export interface NodeEditorData {
  id: string;
  name: string;
  course: string;
  group: string; // Stack
  parentNode: string; // Stack bằng mảng
  cluster: string;
  description: string;
  contents: ContentItem[];
  questions: QuestionItem[];
  prerequisites: string[];
}

export type KnowledgeNodeType = 'Course' | 'LO' | 'Concept' | 'Assignment' | 'Item' | 'Content' | string;
export type KnowledgeEdgeType =
  | 'PREREQUISITE'
  | 'PART_OF'
  | 'RELATED_TO'
  | 'DEVELOP'
  | 'EXPLAIN'
  | 'ASSESS'
  | string;

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  type: KnowledgeNodeType;
  description?: string;
  properties?: Record<string, unknown>;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  type: KnowledgeEdgeType;
  properties?: Record<string, unknown>;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

/* ==================== D1–D5 Course Graph Authoring Workflow ==================== */

export type OutlineState = 'DRAFT' | 'OUTLINE_REVIEW' | 'OUTLINE_APPROVED';
export type ChapterWorkflowState = 'DRAFT' | 'LESSON_REVIEW' | 'LESSON_APPROVED' | 'PUBLISHED';
export type ReviewDecision = 'PENDING' | 'APPROVE' | 'EDIT' | 'REJECT';
export type WorkflowJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'BLOCKED' | 'FAILED';

export interface OutlineChapter {
  id: string;
  title: string;
  description?: string;
  loCodes: string[];
  state: ChapterWorkflowState;
  revision: number;
  documentCount?: number;
}

export interface OutlineLearningOutcome {
  code: string;
  description: string;
}

export interface CourseOutlineData {
  chapters: OutlineChapter[];
  learningOutcomes: OutlineLearningOutcome[];
}

export interface OutlineDraftResponse {
  outline: CourseOutlineData;
  state: OutlineState;
  revision: number;
}

export interface WorkflowJobResponse {
  jobId?: string;
  status: WorkflowJobStatus;
  progress: number;
  result?: {
    revision?: number;
    [key: string]: unknown;
  };
  error?: string;
  canResume: boolean;
  resumeCount: number;
  maxResumeAttempts: number;
  resumeBlockedReason?: string;
}

export interface ChapterLessonItem {
  id: string;
  title: string;
  content: string;
  sourceRef: string;
  loCodes: string[];
  aiComment?: string;
  hasWarning?: boolean;
  decision: ReviewDecision;
  reviewNote?: string;
}

export interface CourseRelationItem {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceChapterId: string;
  targetId: string;
  targetName: string;
  targetChapterId: string;
  relationType: 'PREREQUISITE' | 'PART_OF' | 'RELATED_TO' | 'DEVELOP';
  sourceRef: string;
  aiComment?: string;
  hasWarning?: boolean;
  decision: ReviewDecision;
  reviewNote?: string;
}

export interface PublishCourseResponse {
  state: 'PUBLISHED' | 'PUBLISHING';
  revision: number;
  masterVersion: number;
  warnings: string[];
  publicationId?: string;
}

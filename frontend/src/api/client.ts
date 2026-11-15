import type {
  Announcement, Assignment, AttendanceSession, ClusterView, ConversationMessage, ConversationSummary,
  CourseFile, CourseOverallGrade, CreateAnnouncementInput, CreateAssignmentInput, CreateAttendanceSessionInput,
  CreateConversationInput, CreateQuizInput, CreateTeacherCourseInput, DashboardData, HeatSpot, HomeSlide,
  LearningOutcome, LoginHeroStat, MessageContact, MessagePreview, NodeDetail, NodeEditorData,
  NotificationRecord, PdfFile, ProfileDetails, QueueSummary, Quiz, QuizAttempt, Role, StudentAttendanceData,
  StudentCourse, StudentGradeItem, StudentGraph, SubmitAssignmentInput, SubmitQuizInput, TeacherCourse,
  TeacherCourseTopic, TeacherGradeRow, TeacherGraphData, UpdateAttendanceSessionInput, User,
} from '../types';
import { mockApi } from '../../../mockdata/service';

export const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const rawUser = localStorage.getItem('g4lms.user');
  if (rawUser) {
    const user = JSON.parse(rawUser) as User;
    if (user.accessToken) headers.set('Authorization', `Bearer ${user.accessToken}`);
  }
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  const payload: unknown = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const error = payload && typeof payload === 'object' ? payload as { message?: string; code?: string } : null;
    throw new ApiError(error?.message ?? `Yêu cầu thất bại (${response.status}).`, response.status, error?.code);
  }
  return payload as T;
}

function invoke<T>(mock: () => Promise<T>, path: string, init?: RequestInit): Promise<T> {
  return USE_MOCK_API ? mock() : request<T>(path, init);
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export const api = {
  login: async (identity: string, password: string, role: Role): Promise<User> => {
    if (USE_MOCK_API) return mockApi.login(identity, password, role);
    const response = await request<{ user: Omit<User, 'accessToken'>; accessToken: string }>(
      '/auth/login',
      json('POST', { identity, password }),
    );
    return { ...response.user, accessToken: response.accessToken };
  },
  getDashboard: (): Promise<DashboardData> =>
    invoke(mockApi.getDashboard, '/dashboard'),
  getHomeSlides: (): Promise<HomeSlide[]> =>
    invoke(mockApi.getHomeSlides, '/home/slides'),
  getLoginHeroStats: (): Promise<LoginHeroStat[]> =>
    invoke(mockApi.getLoginHeroStats, '/home/login-stats'),
  getProfileDetails: (role: Role): Promise<ProfileDetails> =>
    invoke(() => mockApi.getProfileDetails(role), '/me/profile'),
  getNotifications: (): Promise<NotificationRecord[]> =>
    invoke(mockApi.getNotifications, '/notifications'),
  markNotificationsRead: (): Promise<void> =>
    invoke(mockApi.markNotificationsRead, '/notifications/read-all', json('POST', {})),
  getMessages: (): Promise<MessagePreview[]> =>
    invoke(mockApi.getMessages, '/messages'),
  getConversations: (): Promise<ConversationSummary[]> =>
    invoke(mockApi.getConversations, '/conversations'),
  getMessageContacts: (): Promise<MessageContact[]> =>
    invoke(mockApi.getMessageContacts, '/conversations/contacts'),
  getConversationMessages: (conversationId: string): Promise<ConversationMessage[]> =>
    invoke(
      () => mockApi.getConversationMessages(conversationId),
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
    ),
  createConversation: (input: CreateConversationInput): Promise<ConversationSummary> =>
    invoke(mockApi.createConversation.bind(null, input), '/conversations', json('POST', input)),
  sendMessage: (conversationId: string, body: string): Promise<ConversationMessage> =>
    invoke(
      () => mockApi.sendMessage(conversationId, body),
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
      json('POST', { body }),
    ),
  markConversationRead: (conversationId: string): Promise<void> =>
    invoke(
      () => mockApi.markConversationRead(conversationId),
      `/conversations/${encodeURIComponent(conversationId)}/read`,
      json('PATCH', {}),
    ),
  getStudentCourses: (): Promise<StudentCourse[]> =>
    invoke(mockApi.getStudentCourses, '/student/courses'),
  getTeacherCourses: (): Promise<TeacherCourse[]> =>
    invoke(mockApi.getTeacherCourses, '/teacher/courses'),
  createTeacherCourse: (input: CreateTeacherCourseInput): Promise<TeacherCourse> =>
    invoke(() => mockApi.createTeacherCourse(input), '/teacher/courses', json('POST', input)),
  getCourseSections: (courseId: string) =>
    invoke(() => mockApi.getCourseSections(courseId), `/courses/${encodeURIComponent(courseId)}/sections`),
  getStudentGrades: (courseId: string): Promise<StudentGradeItem[]> =>
    invoke(() => mockApi.getStudentGrades(courseId), `/student/courses/${encodeURIComponent(courseId)}/grades`),
  getStudentGradeSummary: (): Promise<CourseOverallGrade[]> =>
    invoke(mockApi.getStudentGradeSummary, '/student/grades'),
  getStudentAttendance: (courseId: string): Promise<StudentAttendanceData> =>
    invoke(
      () => mockApi.getStudentAttendance(courseId),
      `/student/courses/${encodeURIComponent(courseId)}/attendance`,
    ),
  getTeacherAttendance: (courseId: string): Promise<AttendanceSession[]> =>
    invoke(
      () => mockApi.getTeacherAttendance(courseId),
      `/teacher/courses/${encodeURIComponent(courseId)}/attendance`,
    ),
  createAttendanceSession: (courseId: string, input: CreateAttendanceSessionInput): Promise<AttendanceSession> =>
    invoke(
      () => mockApi.createAttendanceSession(courseId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/attendance/sessions`,
      json('POST', input),
    ),
  updateAttendanceSession: (
    courseId: string,
    sessionId: string,
    input: UpdateAttendanceSessionInput,
  ): Promise<AttendanceSession> =>
    invoke(
      () => mockApi.updateAttendanceSession(courseId, sessionId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/attendance/sessions/${encodeURIComponent(sessionId)}`,
      json('PATCH', input),
    ),
  getTeacherRoster: (courseId: string) =>
    invoke(() => mockApi.getTeacherRoster(courseId), `/teacher/courses/${encodeURIComponent(courseId)}/students`),
  getTeacherGradebook: (courseId: string): Promise<TeacherGradeRow[]> =>
    invoke(() => mockApi.getTeacherGradebook(courseId), `/teacher/courses/${encodeURIComponent(courseId)}/gradebook`),
  getTeacherCourseTopics: (courseId: string): Promise<TeacherCourseTopic[]> =>
    invoke(() => mockApi.getTeacherCourseTopics(courseId), `/teacher/courses/${encodeURIComponent(courseId)}/topics`),
  getAssignments: (courseId: string, role: Role): Promise<Assignment[]> =>
    invoke(
      () => mockApi.getAssignments(courseId, role),
      `/${role}/courses/${encodeURIComponent(courseId)}/assignments`,
    ),
  getAnnouncements: (courseId: string, role: Role): Promise<Announcement[]> =>
    invoke(
      () => mockApi.getAnnouncements(courseId, role),
      `/${role}/courses/${encodeURIComponent(courseId)}/announcements`,
    ),
  createAnnouncement: (courseId: string, input: CreateAnnouncementInput): Promise<Announcement> =>
    invoke(
      () => mockApi.createAnnouncement(courseId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/announcements`,
      json('POST', input),
    ),
  updateAnnouncementStatus: (courseId: string, announcementId: string, status: Announcement['status']): Promise<Announcement> =>
    invoke(
      () => mockApi.updateAnnouncementStatus(courseId, announcementId, status),
      `/teacher/courses/${encodeURIComponent(courseId)}/announcements/${encodeURIComponent(announcementId)}`,
      json('PATCH', { status }),
    ),
  createAssignment: (courseId: string, input: CreateAssignmentInput): Promise<Assignment> =>
    invoke(() => mockApi.createAssignment(courseId, input), `/teacher/courses/${encodeURIComponent(courseId)}/assignments`, json('POST', input)),
  updateAssignmentStatus: (courseId: string, assignmentId: string, status: Assignment['status']): Promise<Assignment> =>
    invoke(
      () => mockApi.updateAssignmentStatus(courseId, assignmentId, status),
      `/teacher/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}`,
      json('PATCH', { status }),
    ),
  submitAssignment: (courseId: string, assignmentId: string, input: SubmitAssignmentInput): Promise<Assignment> =>
    invoke(
      () => mockApi.submitAssignment(courseId, assignmentId, input),
      `/student/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/submissions`,
      json('POST', input),
    ),
  getQuiz: (courseId: string, quizId: string): Promise<Quiz> =>
    invoke(
      () => mockApi.getQuiz(courseId, quizId),
      `/student/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(quizId)}`,
    ),
  startQuizAttempt: (courseId: string, quizId: string): Promise<QuizAttempt> =>
    invoke(
      () => mockApi.startQuizAttempt(courseId, quizId),
      `/student/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(quizId)}/attempts`,
      json('POST', {}),
    ),
  submitQuizAttempt: (courseId: string, quizId: string, attemptId: string, input: SubmitQuizInput): Promise<QuizAttempt> =>
    invoke(
      () => mockApi.submitQuizAttempt(quizId, attemptId, input),
      `/student/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(quizId)}/attempts/${encodeURIComponent(attemptId)}/submit`,
      json('POST', input),
    ),
  getQuizzes: (courseId: string, role: Role): Promise<Quiz[]> =>
    invoke(
      () => mockApi.getQuizzes(courseId, role),
      `/${role}/courses/${encodeURIComponent(courseId)}/quizzes`,
    ),
  createQuiz: (courseId: string, input: CreateQuizInput): Promise<Quiz> =>
    invoke(
      () => mockApi.createQuiz(courseId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/quizzes`,
      json('POST', input),
    ),
  updateQuizStatus: (courseId: string, quizId: string, status: Quiz['status']): Promise<Quiz> =>
    invoke(
      () => mockApi.updateQuizStatus(courseId, quizId, status),
      `/teacher/courses/${encodeURIComponent(courseId)}/quizzes/${encodeURIComponent(quizId)}`,
      json('PATCH', { status }),
    ),
  getLearningOutcomes: (courseId: string): Promise<LearningOutcome[]> =>
    invoke(() => mockApi.getLearningOutcomes(courseId), `/student/courses/${encodeURIComponent(courseId)}/learning-outcomes`),
  getStudentGraph: (courseId: string, clusterId?: string): Promise<StudentGraph> => {
    const query = clusterId ? `?cluster_id=${encodeURIComponent(clusterId)}` : '';
    return invoke(() => mockApi.getStudentGraph(courseId, clusterId), `/student/courses/${encodeURIComponent(courseId)}/graph${query}`);
  },
  getNodeDetail: (nodeId: string): Promise<NodeDetail> =>
    invoke(() => mockApi.getNodeDetail(nodeId), `/student/nodes/${encodeURIComponent(nodeId)}`),
  getTeacherGraph: (courseId: string): Promise<TeacherGraphData> =>
    invoke(() => mockApi.getTeacherGraph(courseId), `/teacher/courses/${encodeURIComponent(courseId)}/graph`),
  getClusterView: (clusterId: string): Promise<ClusterView> =>
    invoke(() => mockApi.getClusterView(clusterId), `/teacher/clusters/${encodeURIComponent(clusterId)}`),
  getReviewQueue: (courseId: string): Promise<QueueSummary> =>
    invoke(() => mockApi.getReviewQueue(courseId), `/teacher/courses/${encodeURIComponent(courseId)}/review-queue`),
  getHeatSpot: (clusterId?: string): Promise<HeatSpot> => {
    const query = clusterId ? `?cluster_id=${encodeURIComponent(clusterId)}` : '';
    return invoke(() => mockApi.getHeatSpot(clusterId), `/teacher/analytics/heatmap${query}`);
  },
  getCoursePdfs: (courseId: string): Promise<PdfFile[]> =>
    invoke(() => mockApi.getCoursePdfs(courseId), `/teacher/courses/${encodeURIComponent(courseId)}/documents`),
  getCourseFiles: (courseId: string): Promise<CourseFile[]> =>
    invoke(() => mockApi.getCourseFiles(courseId), `/teacher/courses/${encodeURIComponent(courseId)}/documents`),
  uploadCourseFile: (courseId: string, file: File): Promise<CourseFile> => {
    const form = new FormData();
    form.append('file', file);
    return invoke(
      () => mockApi.uploadCourseFile(courseId, file),
      `/teacher/courses/${encodeURIComponent(courseId)}/documents`,
      { method: 'POST', body: form },
    );
  },
  getLoChains: (courseId: string) =>
    invoke(() => mockApi.getLoChains(courseId), `/teacher/courses/${encodeURIComponent(courseId)}/learning-outcomes/chains`),
  getNodeEditor: (nodeId: string): Promise<NodeEditorData> =>
    invoke(() => mockApi.getNodeEditor(nodeId), `/teacher/nodes/${encodeURIComponent(nodeId)}`),
};

import type {
  AdminAnnouncementRecord, AdminCourseOption, AdminCourseRecord, AdminEnrollment, AdminStats, AdminStudentOption, AdminUser, Announcement, Assignment, AssignmentSubmissionRecord,
  AttendanceSession, ClusterView, ConversationMessage, ConversationSummary,
  CourseFile, CourseOverallGrade, CourseRecommendation, CreateAnnouncementInput, CreateAssignmentInput, CreateAttendanceSessionInput,
  CreateConversationInput, CreateQuizInput, CreateTeacherCourseInput, DashboardData, HeatSpot, HomeSlide,
  KnowledgeEdgeType, KnowledgeGraphData, KnowledgeNodeType,
  LearningOutcome, LoginHeroStat, MessageContact, MessagePreview, NodeDetail, NodeEditorData,
  NotificationRecord, PdfFile, ProfileDetails, ProfileRecord, QueueSummary, Quiz, QuizAttempt, Role, StudentAttendanceData,
  StudentCourse, StudentGradeItem, StudentGraph, StudentLearningProfile, SubmitAssignmentInput, SubmitQuizInput, TeacherCourse,
  TeacherCourseTopic, TeacherGradeRow, TeacherGraphData, UpdateAnnouncementInput, UpdateAssignmentInput, UpdateAttendanceSessionInput, UpdateGradebookRowInput, UpdateTeacherCourseInput, User,
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
  const user = getStoredUser();
  if (user?.accessToken) headers.set('Authorization', `Bearer ${user.accessToken}`);
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (response.status === 401 && !path.endsWith('/auth/login')) {
    localStorage.removeItem('g4lms.user');
    window.dispatchEvent(new Event('g4lms:unauthorized'));
  }
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  const payload: unknown = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const error = payload && typeof payload === 'object'
      ? payload as { message?: string; detail?: string | { msg?: string }[]; code?: string }
      : null;
    const detail = Array.isArray(error?.detail)
      ? error.detail.map((item) => item.msg).filter(Boolean).join(' ')
      : error?.detail;
    throw new ApiError(
      error?.message ?? detail ?? `Yêu cầu thất bại (${response.status}).`,
      response.status,
      error?.code,
    );
  }
  return payload as T;
}

function invoke<T>(mock: () => Promise<T>, path: string, init?: RequestInit): Promise<T> {
  return USE_MOCK_API ? mock() : request<T>(path, init);
}

function getStoredUser(): User | null {
  const rawUser = localStorage.getItem('g4lms.user');
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser) as User;
  } catch {
    return null;
  }
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
      json('POST', { identity, password, role }),
    );
    return { ...response.user, accessToken: response.accessToken };
  },
  logout: (): Promise<void> =>
    USE_MOCK_API ? Promise.resolve() : request('/auth/logout', { method: 'POST' }),
  getDashboard: (): Promise<DashboardData> =>
    invoke(mockApi.getDashboard, '/dashboard'),
  getHomeSlides: (): Promise<HomeSlide[]> =>
    invoke(mockApi.getHomeSlides, '/home/slides'),
  getLoginHeroStats: (): Promise<LoginHeroStat[]> =>
    invoke(mockApi.getLoginHeroStats, '/home/login-stats'),
  getProfileDetails: (role: Role): Promise<ProfileDetails> =>
    invoke(() => mockApi.getProfileDetails(role), '/me/profile'),
  getMyProfile: async (): Promise<ProfileRecord> => {
    if (!USE_MOCK_API) return request('/me/profile');
    const user = getStoredUser();
    if (!user) throw new ApiError('Vui lòng đăng nhập lại.', 401);
    const details = user.role === 'student' || user.role === 'teacher'
      ? await mockApi.getProfileDetails(user.role)
      : null;
    return {
      id: details?.id ?? user.id,
      email: user.email,
      fullName: user.name,
      role: user.role,
      dateOfBirth: null,
      studentCode: user.role === 'student' ? details?.id : null,
      staffCode: user.role === 'teacher' ? details?.id : null,
      faculty: null,
      classYear: user.role === 'student' ? details?.extra : null,
      title: user.role === 'teacher' ? details?.extra : null,
    };
  },
  updateMyProfile: async (input: { fullName: string; dateOfBirth: string | null }): Promise<ProfileRecord> => {
    if (!USE_MOCK_API) return request('/me/profile', json('PATCH', input));
    const user = getStoredUser();
    if (!user) throw new ApiError('Vui lòng đăng nhập lại.', 401);
    const updatedUser = { ...user, name: input.fullName.trim() };
    localStorage.setItem('g4lms.user', JSON.stringify(updatedUser));
    return {
      id: user.id,
      email: user.email,
      fullName: updatedUser.name,
      role: user.role,
      dateOfBirth: input.dateOfBirth,
    };
  },
  changePassword: async (input: { currentPassword: string; newPassword: string }): Promise<{ user: User; accessToken: string }> => {
    if (!USE_MOCK_API) return request('/auth/change-password', json('POST', input));
    const user = getStoredUser();
    if (!user) throw new ApiError('Vui lòng đăng nhập lại.', 401);
    return {
      user: { ...user, passwordResetRequired: false },
      accessToken: user.accessToken ?? 'demo-access-token',
    };
  },
  getAdminUsers: (): Promise<AdminUser[]> =>
    USE_MOCK_API ? mockApi.getAdminUsers() : request('/admin/users'),
  createAdminUser: (input: {
    email: string;
    fullName: string;
    role: Role;
    initialPassword: string;
  }): Promise<AdminUser> =>
    USE_MOCK_API ? mockApi.createAdminUser(input) : request('/admin/users', json('POST', input)),
  resetAdminUserPassword: (userId: string, temporaryPassword: string): Promise<void> =>
    USE_MOCK_API
      ? mockApi.resetAdminUserPassword(userId)
      : request(`/admin/users/${encodeURIComponent(userId)}/reset-password`, json('POST', { temporaryPassword })),
  deleteAdminUser: (userId: string): Promise<void> =>
    USE_MOCK_API
      ? mockApi.deleteAdminUser(userId)
      : request(`/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  getAdminEnrollments: (): Promise<{
    students: AdminStudentOption[];
    courses: AdminCourseOption[];
    enrollments: AdminEnrollment[];
  }> =>
    USE_MOCK_API ? mockApi.getAdminEnrollments() : request('/admin/enrollments'),
  createAdminEnrollment: (input: { studentId: string; courseId: string }): Promise<AdminEnrollment> =>
    USE_MOCK_API ? mockApi.createAdminEnrollment(input) : request('/admin/enrollments', json('POST', input)),
  deleteAdminEnrollment: (enrollmentId: string): Promise<void> =>
    USE_MOCK_API
      ? mockApi.deleteAdminEnrollment(enrollmentId)
      : request(`/admin/enrollments/${encodeURIComponent(enrollmentId)}`, { method: 'DELETE' }),
  getAdminStats: (): Promise<AdminStats> =>
    USE_MOCK_API ? mockApi.getAdminStats() : request('/admin/stats'),
  getAdminCourses: (): Promise<AdminCourseRecord[]> =>
    USE_MOCK_API ? mockApi.getAdminCourses() : request('/admin/courses'),
  createAdminCourse: (input: {
    code: string;
    title: string;
    description?: string;
    faculty: string;
    semester?: string;
    year?: number;
    theme?: TeacherCourse['theme'];
    published?: boolean;
    lecturerId?: string | null;
  }): Promise<AdminCourseRecord> =>
    USE_MOCK_API ? mockApi.createAdminCourse(input) : request('/admin/courses', json('POST', input)),
  updateAdminCourse: (courseId: string, input: UpdateTeacherCourseInput): Promise<AdminCourseRecord> =>
    USE_MOCK_API
      ? mockApi.updateAdminCourse(courseId, input)
      : request(`/admin/courses/${encodeURIComponent(courseId)}`, json('PATCH', input)),
  deleteAdminCourse: (courseId: string): Promise<void> =>
    USE_MOCK_API
      ? mockApi.deleteAdminCourse(courseId)
      : request(`/admin/courses/${encodeURIComponent(courseId)}`, { method: 'DELETE' }),
  getAdminAnnouncements: (): Promise<AdminAnnouncementRecord[]> =>
    USE_MOCK_API ? mockApi.getAdminAnnouncements() : request('/admin/announcements'),
  createAdminAnnouncement: (input: {
    title: string;
    body: string;
    courseId?: string | null;
    isGlobal?: boolean;
    status?: 'draft' | 'published';
  }): Promise<AdminAnnouncementRecord> =>
    USE_MOCK_API ? mockApi.createAdminAnnouncement(input) : request('/admin/announcements', json('POST', input)),
  updateAdminAnnouncement: (
    announcementId: string,
    input: { title?: string; body?: string; status?: 'draft' | 'published'; isGlobal?: boolean },
  ): Promise<AdminAnnouncementRecord> =>
    USE_MOCK_API
      ? mockApi.updateAdminAnnouncement(announcementId, input)
      : request(`/admin/announcements/${encodeURIComponent(announcementId)}`, json('PATCH', input)),
  deleteAdminAnnouncement: (announcementId: string): Promise<void> =>
    USE_MOCK_API
      ? mockApi.deleteAdminAnnouncement(announcementId)
      : request(`/admin/announcements/${encodeURIComponent(announcementId)}`, { method: 'DELETE' }),
  getHomeAnnouncements: (): Promise<AdminAnnouncementRecord[]> =>
    invoke(mockApi.getHomeAnnouncements, '/home/announcements'),
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
  updateTeacherCourse: (courseId: string, input: UpdateTeacherCourseInput): Promise<TeacherCourse> =>
    invoke(
      () => mockApi.updateTeacherCourse(courseId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}`,
      json('PATCH', input),
    ),
  deleteTeacherCourse: (courseId: string): Promise<void> =>
    invoke(
      () => mockApi.deleteTeacherCourse(courseId),
      `/teacher/courses/${encodeURIComponent(courseId)}`,
      { method: 'DELETE' },
    ),
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
  deleteAttendanceSession: (courseId: string, sessionId: string): Promise<void> =>
    invoke(
      () => mockApi.deleteAttendanceSession(courseId, sessionId),
      `/teacher/courses/${encodeURIComponent(courseId)}/attendance/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' },
    ),
  getTeacherRoster: (courseId: string) =>
    invoke(() => mockApi.getTeacherRoster(courseId), `/teacher/courses/${encodeURIComponent(courseId)}/students`),
  getTeacherGradebook: (courseId: string): Promise<TeacherGradeRow[]> =>
    invoke(() => mockApi.getTeacherGradebook(courseId), `/teacher/courses/${encodeURIComponent(courseId)}/gradebook`),
  updateTeacherGradebookRow: (
    courseId: string,
    studentId: string,
    input: UpdateGradebookRowInput,
  ): Promise<TeacherGradeRow> =>
    invoke(
      () => mockApi.updateTeacherGradebookRow(courseId, studentId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/gradebook/${encodeURIComponent(studentId)}`,
      json('PATCH', input),
    ),
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
  updateAnnouncement: (courseId: string, announcementId: string, input: UpdateAnnouncementInput): Promise<Announcement> =>
    invoke(
      () => mockApi.updateAnnouncement(courseId, announcementId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/announcements/${encodeURIComponent(announcementId)}`,
      json('PATCH', input),
    ),
  deleteAnnouncement: (courseId: string, announcementId: string): Promise<void> =>
    invoke(
      () => mockApi.deleteAnnouncement(courseId, announcementId),
      `/teacher/courses/${encodeURIComponent(courseId)}/announcements/${encodeURIComponent(announcementId)}`,
      { method: 'DELETE' },
    ),
  createAssignment: (courseId: string, input: CreateAssignmentInput): Promise<Assignment> =>
    invoke(() => mockApi.createAssignment(courseId, input), `/teacher/courses/${encodeURIComponent(courseId)}/assignments`, json('POST', input)),
  updateAssignmentStatus: (courseId: string, assignmentId: string, status: Assignment['status']): Promise<Assignment> =>
    invoke(
      () => mockApi.updateAssignmentStatus(courseId, assignmentId, status),
      `/teacher/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}`,
      json('PATCH', { status }),
    ),
  updateAssignment: (courseId: string, assignmentId: string, input: UpdateAssignmentInput): Promise<Assignment> =>
    invoke(
      () => mockApi.updateAssignment(courseId, assignmentId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}`,
      json('PATCH', input),
    ),
  deleteAssignment: (courseId: string, assignmentId: string): Promise<void> =>
    invoke(
      () => mockApi.deleteAssignment(courseId, assignmentId),
      `/teacher/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}`,
      { method: 'DELETE' },
    ),
  submitAssignment: (courseId: string, assignmentId: string, input: SubmitAssignmentInput): Promise<Assignment> =>
    invoke(
      () => mockApi.submitAssignment(courseId, assignmentId, input),
      `/student/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/submissions`,
      json('POST', input),
    ),
  getAssignmentSubmissions: (courseId: string, assignmentId: string): Promise<AssignmentSubmissionRecord[]> =>
    invoke(
      () => mockApi.getAssignmentSubmissions(courseId, assignmentId),
      `/teacher/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/submissions`,
    ),
  gradeSubmission: (
    courseId: string,
    assignmentId: string,
    submissionId: string,
    input: { score: number; feedback?: string | null },
  ): Promise<AssignmentSubmissionRecord> =>
    invoke(
      () => mockApi.gradeSubmission(courseId, assignmentId, submissionId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}`,
      json('PATCH', input),
    ),
  getStudentLearningProfile: (courseId?: string): Promise<StudentLearningProfile> => {
    const query = courseId ? `?course_id=${encodeURIComponent(courseId)}` : '';
    return invoke(() => mockApi.getStudentLearningProfile(courseId), `/student/learning-profile${query}`);
  },
  getCourseRecommendations: (courseId: string): Promise<CourseRecommendation[]> =>
    invoke(() => mockApi.getCourseRecommendations(courseId), `/student/courses/${encodeURIComponent(courseId)}/recommendations`),

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
  getKnowledgeGraph: (courseId: string): Promise<KnowledgeGraphData> =>
    invoke(
      () => mockApi.getKnowledgeGraph(courseId),
      `/courses/${encodeURIComponent(courseId)}/knowledge-graph`,
    ),
  getCourseGraph: (courseId: string): Promise<TeacherGraphData> =>
    invoke(() => mockApi.getCourseGraph(courseId), `/courses/${encodeURIComponent(courseId)}/graph`),
  getCourseClusterView: (courseId: string, clusterId: string): Promise<ClusterView> =>
    invoke(
      () => mockApi.getCourseClusterView(courseId, clusterId),
      `/courses/${encodeURIComponent(courseId)}/clusters/${encodeURIComponent(clusterId)}`,
    ),
  getTeacherGraph: (courseId: string): Promise<TeacherGraphData> =>
    invoke(() => mockApi.getTeacherGraph(courseId), `/teacher/courses/${encodeURIComponent(courseId)}/graph`),
  getClusterView: (clusterId: string): Promise<ClusterView> =>
    invoke(() => mockApi.getClusterView(clusterId), `/teacher/clusters/${encodeURIComponent(clusterId)}`),
  createGraphNode: (
    courseId: string,
    input: {
      name: string;
      nodeType?: KnowledgeNodeType;
      clusterId?: string | null;
      description?: string;
      x?: number;
      y?: number;
      lo?: string[];
      properties?: Record<string, unknown>;
    },
  ): Promise<Record<string, unknown>> =>
    invoke(
      () => mockApi.createGraphNode(courseId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/graph/nodes`,
      json('POST', input),
    ),
  updateGraphNode: (
    courseId: string,
    nodeId: string,
    input: {
      name?: string;
      description?: string;
      status?: 'approved' | 'draft' | 'pending_review' | 'outside_cluster' | 'proposed';
      approved?: boolean;
      lo?: string[];
      properties?: Record<string, unknown>;
    },
  ): Promise<Record<string, unknown>> =>
    invoke(
      () => mockApi.updateGraphNode(courseId, nodeId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/graph/nodes/${encodeURIComponent(nodeId)}`,
      json('PATCH', input),
    ),
  deleteGraphNode: (courseId: string, nodeId: string): Promise<void> =>
    invoke(
      () => mockApi.deleteGraphNode(courseId, nodeId),
      `/teacher/courses/${encodeURIComponent(courseId)}/graph/nodes/${encodeURIComponent(nodeId)}`,
      { method: 'DELETE' },
    ),
  createGraphEdge: (
    courseId: string,
    input: { fromId: string; toId: string; kind: KnowledgeEdgeType | 'prereq' | 'related' | 'concept'; clusterId?: string | null; properties?: Record<string, unknown> },
  ): Promise<{ from: string; to: string; kind: string }> =>
    invoke(
      () => mockApi.createGraphEdge(courseId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/graph/edges`,
      json('POST', { fromId: input.fromId, toId: input.toId, kind: input.kind, properties: input.properties ?? {} }),
    ),
  deleteGraphEdge: (
    courseId: string,
    input: { fromId: string; toId: string; edgeType?: string | null; clusterId?: string | null },
  ): Promise<void> =>
    invoke(
      () => mockApi.deleteGraphEdge(courseId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/graph/edges`,
      json('DELETE', { fromId: input.fromId, toId: input.toId, edgeType: input.edgeType ?? null }),
    ),
  approveGraphEdge: (
    courseId: string,
    input: { fromId: string; toId: string; edgeType?: string | null },
  ): Promise<void> =>
    invoke(
      () => mockApi.approveGraphEdge(courseId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/graph/edges/approve`,
      json('POST', { fromId: input.fromId, toId: input.toId, edgeType: input.edgeType ?? null }),
    ),
  mergeGraphNodes: (
    courseId: string,
    input: { keepId: string; mergeId: string; clusterId?: string | null },
  ): Promise<{ id: string }> =>
    invoke(
      () => mockApi.mergeGraphNodes(courseId, input),
      `/teacher/courses/${encodeURIComponent(courseId)}/graph/nodes/merge`,
      json('POST', { keepId: input.keepId, mergeId: input.mergeId }),
    ),
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
    invoke(() => mockApi.getLoChains(courseId), `/courses/${encodeURIComponent(courseId)}/learning-outcomes/chains`),
  getNodeEditor: (nodeId: string): Promise<NodeEditorData> =>
    invoke(() => mockApi.getNodeEditor(nodeId), `/teacher/nodes/${encodeURIComponent(nodeId)}`),

};

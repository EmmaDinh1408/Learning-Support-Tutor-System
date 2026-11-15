import type {
  Announcement, Assignment, AttendanceSession, ClusterView, ConversationMessage, ConversationSummary,
  CourseFile, CourseOverallGrade, CreateAnnouncementInput, CreateAssignmentInput, CreateAttendanceSessionInput,
  CreateConversationInput, CreateQuizInput, CreateTeacherCourseInput, DashboardData, HeatSpot, HomeSlide,
  LearningOutcome, LoginHeroStat, MessageContact, MessagePreview, NodeDetail, NodeEditorData,
  NotificationRecord, PdfFile, ProfileDetails, QueueSummary, Quiz, QuizAttempt, Role, StudentAttendanceData,
  StudentCourse, StudentGradeItem, StudentGraph, SubmitAssignmentInput, SubmitQuizInput, TeacherCourse,
  TeacherCourseTopic, TeacherGradeRow, TeacherGraphData, UpdateAttendanceSessionInput, User,
} from '../frontend/src/types';
import * as data from './fixtures';
import { quizFixtures } from './quizFixtures';
import {
  assignments, attendanceSessions, calendarEvents, conversationMessages, conversations, courseAnnouncements,
  courseOverallGrades, dashboardActivities, homepageSlides, loginHeroStats, messageContacts,
  networkCourseSections, notifications, profileDetails, studentCourseSections, studentGradesByCourse,
  teacherCourseTopics, teacherGradebook, teacherRoster,
} from './portalFixtures';

const wait = <T,>(value: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));
const attempts = new Map<string, QuizAttempt>();
const uploadedFiles: CourseFile[] = [];

function toMessagePreview(conversation: ConversationSummary): MessagePreview {
  return {
    id: conversation.id,
    initials: conversation.initials,
    sender: conversation.participantName,
    time: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
      .format(new Date(conversation.lastMessageAt)),
    preview: conversation.lastMessage,
    unread: conversation.unreadCount > 0,
  };
}

export const mockApi = {
  login(identity: string, _password: string, role: Role): Promise<User> {
    const teacher = role === 'teacher';
    const email = identity || (teacher ? 'giangvien@hcmut.edu.vn' : 'sinhvien@hcmut.edu.vn');
    const name = teacher ? 'Nguyễn Văn Hùng' : 'Nguyễn Anh';
    return wait({ id: 'usr-demo', name, initials: teacher ? 'NH' : 'NA', email, role, accessToken: 'demo-access-token' });
  },
  getDashboard: (): Promise<DashboardData> => wait({
    activities: dashboardActivities,
    calendarEvents,
  }),
  getHomeSlides: (): Promise<HomeSlide[]> => wait(homepageSlides),
  getLoginHeroStats: (): Promise<LoginHeroStat[]> => wait(loginHeroStats),
  getProfileDetails: (role: Role): Promise<ProfileDetails> => wait(profileDetails[role]),
  getNotifications: (): Promise<NotificationRecord[]> => wait(notifications),
  markNotificationsRead: (): Promise<void> => {
    notifications.forEach((notification) => { notification.read = true; });
    return wait(undefined);
  },
  getMessages: (): Promise<MessagePreview[]> => wait(conversations.map(toMessagePreview)),
  getConversations: (): Promise<ConversationSummary[]> => wait([...conversations]),
  getMessageContacts: (): Promise<MessageContact[]> => wait([...messageContacts]),
  getConversationMessages: (conversationId: string): Promise<ConversationMessage[]> => {
    if (!conversations.some((conversation) => conversation.id === conversationId)) {
      return Promise.reject(new Error('Không tìm thấy cuộc trò chuyện.'));
    }
    return wait([...(conversationMessages[conversationId] ?? [])]);
  },
  createConversation(input: CreateConversationInput): Promise<ConversationSummary> {
    const contact = messageContacts.find((item) => item.id === input.recipientId);
    if (!contact) return Promise.reject(new Error('Người nhận không khả dụng.'));
    if (!input.message.trim()) return Promise.reject(new Error('Tin nhắn không được để trống.'));
    const now = new Date().toISOString();
    const existing = conversations.find((item) => item.participantId === contact.id);
    const conversation: ConversationSummary = existing ?? {
      id: `conv-${Date.now()}`,
      participantId: contact.id,
      participantName: contact.name,
      initials: contact.initials,
      courseCode: contact.courseCode,
      lastMessage: '',
      lastMessageAt: now,
      unreadCount: 0,
    };
    if (!existing) conversations.unshift(conversation);
    const message: ConversationMessage = {
      id: `msg-${Date.now()}`,
      conversationId: conversation.id,
      senderId: 'usr-demo',
      senderName: 'Nguyễn Anh',
      body: input.message.trim(),
      sentAt: now,
    };
    conversationMessages[conversation.id] = [...(conversationMessages[conversation.id] ?? []), message];
    conversation.lastMessage = message.body;
    conversation.lastMessageAt = now;
    conversation.unreadCount = 0;
    return wait(conversation);
  },
  sendMessage(conversationId: string, body: string): Promise<ConversationMessage> {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return Promise.reject(new Error('Không tìm thấy cuộc trò chuyện.'));
    if (!body.trim()) return Promise.reject(new Error('Tin nhắn không được để trống.'));
    const message: ConversationMessage = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: 'usr-demo',
      senderName: 'Nguyễn Anh',
      body: body.trim(),
      sentAt: new Date().toISOString(),
    };
    conversationMessages[conversationId] = [...(conversationMessages[conversationId] ?? []), message];
    conversation.lastMessage = message.body;
    conversation.lastMessageAt = message.sentAt;
    return wait(message);
  },
  markConversationRead(conversationId: string): Promise<void> {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return Promise.reject(new Error('Không tìm thấy cuộc trò chuyện.'));
    conversation.unreadCount = 0;
    return wait(undefined);
  },
  getStudentCourses: (): Promise<StudentCourse[]> => wait(data.studentCourses),
  getTeacherCourses: (): Promise<TeacherCourse[]> => wait(data.teacherCourses),
  createTeacherCourse(input: CreateTeacherCourseInput): Promise<TeacherCourse> {
    const course: TeacherCourse = {
      ...input, id: input.code, theme: 'orange', students: 0, published: false, nodesWithContent: 0, totalNodes: 0,
    };
    data.teacherCourses.unshift(course);
    return wait(course);
  },
  getCourseSections: (courseId: string) => wait(courseId === 'CO3093' ? networkCourseSections : studentCourseSections),
  getStudentGrades: (courseId: string): Promise<StudentGradeItem[]> => wait(studentGradesByCourse[courseId] ?? []),
  getStudentGradeSummary: (): Promise<CourseOverallGrade[]> => wait(courseOverallGrades),
  getStudentAttendance(courseId: string): Promise<StudentAttendanceData> {
    const studentId = '2252001';
    const records = attendanceSessions
      .filter((session) => session.courseId === courseId && session.status === 'published')
      .flatMap((session) => {
        const entry = session.records.find((record) => record.studentId === studentId);
        return entry && entry.status !== 'unmarked'
          ? [{ sessionId: session.id, title: session.title, date: session.date, status: entry.status }]
          : [];
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    const counts = {
      present: records.filter((record) => record.status === 'present').length,
      absent: records.filter((record) => record.status === 'absent').length,
      late: records.filter((record) => record.status === 'late').length,
      excused: records.filter((record) => record.status === 'excused').length,
    };
    const totalSessions = records.length;
    const attended = counts.present + counts.late + counts.excused;
    return wait({
      totalSessions,
      ...counts,
      attendanceRate: totalSessions ? Math.round(attended / totalSessions * 100) : 0,
      records,
    });
  },
  getTeacherAttendance(courseId: string): Promise<AttendanceSession[]> {
    return wait(attendanceSessions.filter((session) => session.courseId === courseId));
  },
  createAttendanceSession(courseId: string, input: CreateAttendanceSessionInput): Promise<AttendanceSession> {
    if (!input.title.trim()) return Promise.reject(new Error('Tên buổi học không được để trống.'));
    if (attendanceSessions.some((session) => session.courseId === courseId && session.date === input.date)) {
      return Promise.reject(new Error('Đã có buổi điểm danh vào ngày này.'));
    }
    const session: AttendanceSession = {
      id: `attendance-${Date.now()}`,
      courseId,
      title: input.title.trim(),
      date: input.date,
      status: 'draft',
      records: teacherRoster.map((student) => ({
        studentId: student.id, name: student.name, status: 'unmarked',
      })),
    };
    attendanceSessions.unshift(session);
    return wait(session);
  },
  updateAttendanceSession(
    courseId: string,
    sessionId: string,
    input: UpdateAttendanceSessionInput,
  ): Promise<AttendanceSession> {
    const session = attendanceSessions.find((item) => item.courseId === courseId && item.id === sessionId);
    if (!session) return Promise.reject(new Error('Không tìm thấy buổi điểm danh.'));
    const rosterIds = new Set(teacherRoster.map((student) => student.id));
    const submittedIds = new Set(input.records.map((record) => record.studentId));
    if (submittedIds.size !== rosterIds.size || [...rosterIds].some((id) => !submittedIds.has(id))) {
      return Promise.reject(new Error('Danh sách điểm danh không khớp với danh sách học viên.'));
    }
    if (input.status === 'published' && input.records.some((record) => record.status === 'unmarked')) {
      return Promise.reject(new Error('Cần điểm danh đầy đủ trước khi công bố.'));
    }
    session.records = input.records.map((record) => ({
      ...record,
      name: teacherRoster.find((student) => student.id === record.studentId)?.name ?? record.name,
    }));
    session.status = input.status;
    return wait(session);
  },
  getTeacherRoster: (_courseId: string) => wait(teacherRoster),
  getTeacherGradebook: (_courseId: string): Promise<TeacherGradeRow[]> => wait(teacherGradebook),
  getTeacherCourseTopics: (_courseId: string): Promise<TeacherCourseTopic[]> => wait(teacherCourseTopics),
  getAssignments(courseId: string, role: Role): Promise<Assignment[]> {
    const rows = assignments.filter((item) => item.courseId === courseId && (role === 'teacher' || item.status === 'published'));
    return wait(rows);
  },
  getAnnouncements(courseId: string, role: Role): Promise<Announcement[]> {
    return wait(courseAnnouncements.filter((item) => item.courseId === courseId && (role === 'teacher' || item.status === 'published')));
  },
  createAnnouncement(courseId: string, input: CreateAnnouncementInput): Promise<Announcement> {
    const now = new Date().toISOString();
    const item: Announcement = { ...input, id: `ann-${Date.now()}`, courseId, status: 'draft', createdAt: now };
    courseAnnouncements.unshift(item);
    return wait(item);
  },
  updateAnnouncementStatus(courseId: string, announcementId: string, status: Announcement['status']): Promise<Announcement> {
    const item = courseAnnouncements.find((entry) => entry.courseId === courseId && entry.id === announcementId);
    if (!item) return Promise.reject(new Error('Không tìm thấy thông báo.'));
    item.status = status;
    item.publishedAt = status === 'published' ? new Date().toISOString() : undefined;
    return wait(item);
  },
  createAssignment(courseId: string, input: CreateAssignmentInput): Promise<Assignment> {
    const assignment: Assignment = {
      ...input, id: `asg-${Date.now()}`, courseId, status: 'draft',
    };
    assignments.unshift(assignment);
    return wait(assignment);
  },
  updateAssignmentStatus(courseId: string, assignmentId: string, status: Assignment['status']): Promise<Assignment> {
    const assignment = assignments.find((item) => item.courseId === courseId && item.id === assignmentId);
    if (!assignment) return Promise.reject(new Error('Không tìm thấy bài tập.'));
    assignment.status = status;
    return wait(assignment);
  },
  submitAssignment(courseId: string, assignmentId: string, input: SubmitAssignmentInput): Promise<Assignment> {
    const assignment = assignments.find((item) => item.courseId === courseId && item.id === assignmentId);
    if (!assignment || assignment.status !== 'published') return Promise.reject(new Error('Bài tập không khả dụng.'));
    assignment.submissionText = input.text;
    assignment.submissionStatus = 'submitted';
    assignment.submittedAt = new Date().toISOString();
    return wait(assignment);
  },
  getQuizzes(courseId: string, role: Role): Promise<Quiz[]> {
    return wait(quizFixtures
      .filter(({ quiz }) => quiz.courseId === courseId && (role === 'teacher' || quiz.status === 'published'))
      .map(({ quiz }) => quiz));
  },
  createQuiz(courseId: string, input: CreateQuizInput): Promise<Quiz> {
    if (!input.title.trim() || input.questions.length === 0) {
      return Promise.reject(new Error('Quiz cần có tiêu đề và ít nhất một câu hỏi.'));
    }
    const id = `quiz-${Date.now()}`;
    const answerKey: Record<string, string> = {};
    const questions = input.questions.map(({ correctOptionId, ...question }) => {
      if (!question.options.some((option) => option.id === correctOptionId)) {
        throw new Error('Đáp án đúng phải thuộc một lựa chọn của câu hỏi.');
      }
      answerKey[question.id] = correctOptionId;
      return question;
    });
    const quiz: Quiz = {
      id,
      courseId,
      title: input.title.trim(),
      description: input.description.trim(),
      timeLimitMinutes: input.timeLimitMinutes,
      attemptsAllowed: input.attemptsAllowed,
      attemptsUsed: 0,
      status: 'draft',
      questions,
    };
    quizFixtures.unshift({ quiz, answerKey });
    return wait(quiz);
  },
  updateQuizStatus(courseId: string, quizId: string, status: Quiz['status']): Promise<Quiz> {
    const fixture = quizFixtures.find(({ quiz }) => quiz.id === quizId && quiz.courseId === courseId);
    if (!fixture) return Promise.reject(new Error('Không tìm thấy quiz.'));
    fixture.quiz.status = status;
    return wait(fixture.quiz);
  },
  getQuiz(courseId: string, quizId: string): Promise<Quiz> {
    const fixture = quizFixtures.find(({ quiz }) => quiz.id === quizId && quiz.courseId === courseId);
    if (!fixture || fixture.quiz.status !== 'published') return Promise.reject(new Error('Không tìm thấy bài kiểm tra.'));
    return wait(fixture.quiz);
  },
  startQuizAttempt(courseId: string, quizId: string): Promise<QuizAttempt> {
    const fixture = quizFixtures.find(({ quiz }) => quiz.id === quizId && quiz.courseId === courseId);
    if (!fixture || fixture.quiz.status !== 'published') return Promise.reject(new Error('Bài kiểm tra không khả dụng.'));
    if (fixture.quiz.attemptsUsed >= fixture.quiz.attemptsAllowed) return Promise.reject(new Error('Bạn đã sử dụng hết số lần làm bài.'));
    fixture.quiz.attemptsUsed += 1;
    const startedAt = new Date();
    const attempt: QuizAttempt = {
      id: `attempt-${Date.now()}`,
      quizId,
      startedAt: startedAt.toISOString(),
      expiresAt: new Date(startedAt.getTime() + fixture.quiz.timeLimitMinutes * 60_000).toISOString(),
      maxScore: 10,
      totalQuestions: fixture.quiz.questions.length,
    };
    attempts.set(attempt.id, attempt);
    return wait(attempt);
  },
  submitQuizAttempt(quizId: string, attemptId: string, input: SubmitQuizInput): Promise<QuizAttempt> {
    const fixture = quizFixtures.find(({ quiz }) => quiz.id === quizId);
    const attempt = attempts.get(attemptId);
    if (!fixture || !attempt || attempt.quizId !== quizId || attempt.submittedAt) {
      return Promise.reject(new Error('Lần làm bài không hợp lệ hoặc đã được nộp.'));
    }
    const correctCount = Object.entries(fixture.answerKey)
      .filter(([questionId, answer]) => input.answers[questionId] === answer).length;
    const submitted: QuizAttempt = {
      ...attempt,
      submittedAt: new Date().toISOString(),
      correctCount,
      score: correctCount / attempt.totalQuestions * attempt.maxScore,
    };
    attempts.set(attemptId, submitted);
    return wait(submitted);
  },
  getLearningOutcomes: (_courseId: string): Promise<LearningOutcome[]> => wait(data.learningOutcomes),
  getStudentGraph: (courseId: string, clusterId?: string): Promise<StudentGraph> =>
    wait(courseId === 'CO3093'
      ? data.computerNetworksOverview
      : clusterId === 'pointer' ? data.studentPointerCluster : data.studentOverview),
  getNodeDetail: (nodeId: string): Promise<NodeDetail> => wait(data.buildNodeDetail(nodeId), 60),
  getTeacherGraph: (courseId: string): Promise<TeacherGraphData> =>
    wait(courseId === 'CO3093' ? data.computerNetworksTeacherGraph : data.teacherGraph),
  getClusterView: (clusterId: string): Promise<ClusterView> => wait(data.buildClusterView(clusterId)),
  getReviewQueue: (_courseId: string): Promise<QueueSummary> => wait(data.reviewQueue),
  getHeatSpot: (clusterId?: string): Promise<HeatSpot> => wait(data.heatSpots[clusterId ?? ''] ?? data.heatSpots.pointer, 60),
  getCourseFiles(courseId: string): Promise<CourseFile[]> {
    const saved = data.pdfFiles
      .filter((file) => file.courseId === courseId)
      .map((file) => ({
        id: file.id,
        courseId,
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        uploadedAt: file.uploadedAt,
      }));
    return wait([...uploadedFiles.filter((file) => file.courseId === courseId), ...saved]);
  },
  uploadCourseFile(courseId: string, file: File): Promise<CourseFile> {
    const allowed = /\.(pdf|ppt|pptx|doc|docx|mp4|mov|zip)$/i.test(file.name);
    if (!allowed) return Promise.reject(new Error('Định dạng tệp không được hỗ trợ.'));
    if (file.size === 0 || file.size > 50 * 1024 * 1024) {
      return Promise.reject(new Error('Tệp phải có dung lượng từ 1 byte đến 50 MB.'));
    }
    const uploadedAt = new Date().toISOString();
    const item: CourseFile = {
      id: `file-${Date.now()}`,
      courseId,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      uploadedAt,
    };
    uploadedFiles.unshift(item);
    if (item.mimeType === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      data.pdfFiles.unshift({
        ...item,
        pages: 0,
        sizeMb: Number((file.size / 1048576).toFixed(1)),
        date: new Intl.DateTimeFormat('vi-VN').format(new Date(uploadedAt)),
      });
    }
    return wait(item);
  },
  getCoursePdfs: (courseId: string): Promise<PdfFile[]> =>
    wait(data.pdfFiles.filter((file) => file.courseId === courseId)),
  getLoChains: (_courseId: string) => wait(data.loChains),
  getNodeEditor: (nodeId: string): Promise<NodeEditorData> => wait(data.buildNodeEditor(nodeId)),
};

import type {
  AdminAnnouncementRecord, AdminCourseOption, AdminCourseRecord, AdminEnrollment, AdminStats, AdminStudentOption, AdminUser, Announcement, Assignment, AssignmentSubmissionRecord, AttendanceSession, ClusterView, ConversationMessage, ConversationSummary,
  CourseFile, CourseOverallGrade, CourseRecommendation, CreateAnnouncementInput, CreateAssignmentInput, CreateAttendanceSessionInput,
  CreateConversationInput, CreateQuizInput, CreateTeacherCourseInput, DashboardData, HeatSpot, HomeSlide,
  LearningOutcome, LoginHeroStat, MessageContact, MessagePreview, NodeDetail, NodeEditorData,
  NotificationRecord, PdfFile, ProfileDetails, QueueSummary, Quiz, QuizAttempt, Role, StudentAttendanceData,
  StudentCourse, StudentGradeItem, StudentGraph, StudentLearningProfile, SubmitAssignmentInput, SubmitQuizInput, TeacherCourse,
  TeacherCourseTopic, TeacherGradeRow, TeacherGraphData, UpdateAnnouncementInput, UpdateAssignmentInput, UpdateAttendanceSessionInput, UpdateGradebookRowInput, UpdateTeacherCourseInput, User,
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
const adminUsers: AdminUser[] = [
  { id: 'usr-admin-demo', email: 'admin@hcmut.edu.vn', name: 'Quản trị G4LMS', role: 'admin', createdAt: '2026-01-01T00:00:00Z', active: true },
  { id: 'usr-student-demo', email: 'sinhvien@hcmut.edu.vn', name: 'Nguyễn Anh', role: 'student', createdAt: '2026-01-02T00:00:00Z', active: true },
  { id: 'usr-teacher-demo', email: 'giangvien@hcmut.edu.vn', name: 'Nguyễn Văn Hùng', role: 'teacher', createdAt: '2026-01-03T00:00:00Z', active: true },
];
const adminEnrollments: AdminEnrollment[] = [
  {
    id: 'enr-demo-1',
    studentId: 'usr-student-demo',
    studentName: 'Nguyễn Anh',
    studentEmail: 'sinhvien@hcmut.edu.vn',
    courseId: 'CO3093',
    courseCode: 'CO3093',
    courseTitle: 'Mạng máy tính',
    enrolledAt: '2026-09-01T08:00:00Z',
    progress: 62,
  },
];
const adminAnnouncements: AdminAnnouncementRecord[] = [
  {
    id: 'ann_global_1',
    courseId: null,
    courseName: 'Toàn trường',
    title: 'Tuyển sinh sau đại học 2026',
    body: 'Phòng Đào tạo Sau đại học thông báo kế hoạch tuyển sinh đợt 1 năm 2026 cho các ngành Kỹ thuật Máy tính và Khoa học Máy tính.',
    status: 'published',
    isGlobal: true,
    authorName: 'Phòng Đào tạo',
    createdAt: '2026-11-10T08:00:00Z',
    publishedAt: '2026-11-10T08:00:00Z',
  },
  {
    id: 'ann_global_2',
    courseId: null,
    courseName: 'Toàn trường',
    title: 'Lịch thi cuối kỳ học kỳ 1 đã được công bố',
    body: 'Sinh viên kiểm tra lịch thi cuối kỳ chính thức và phòng thi trên cổng thông tin đào tạo.',
    status: 'published',
    isGlobal: true,
    authorName: 'Phòng Khảo thí & ĐBCL',
    createdAt: '2026-11-08T09:30:00Z',
    publishedAt: '2026-11-08T09:30:00Z',
  },
  {
    id: 'ann_global_3',
    courseId: null,
    courseName: 'Toàn trường',
    title: 'Hội thảo Công nghệ Phần mềm & AI trong Giáo dục',
    body: 'Khoa KH&KT Máy tính tổ chức hội thảo chuyên đề về ứng dụng Knowledge Graph và Microlearning trong đào tạo đại học.',
    status: 'published',
    isGlobal: true,
    authorName: 'Khoa KH&KT Máy tính',
    createdAt: '2026-11-05T14:00:00Z',
    publishedAt: '2026-11-05T14:00:00Z',
  },
];
const assignmentSubmissions: Record<string, AssignmentSubmissionRecord[]> = {
  'asg-1': [
    {
      id: 'sub-demo-1',
      studentId: '2252001',
      studentName: 'Nguyễn Anh',
      text: 'Báo cáo phân tích phiên bắt tay TCP 3 bước và cửa sổ tắc nghẽn cwnd trên Wireshark.',
      submittedAt: '2026-11-14T15:20:00+07:00',
      status: 'submitted',
      score: null,
      feedback: null,
    },
  ],
  'asg-2': [
    {
      id: 'sub-demo-2',
      studentId: '2252001',
      studentName: 'Nguyễn Anh',
      text: 'Đã nộp báo cáo phân tích HTTP/2, DNS caching và độ trễ truy vấn.',
      submittedAt: '2026-11-09T20:10:00+07:00',
      status: 'graded',
      score: 8.5,
      feedback: 'Phân tích tốt, cần bổ sung nguồn tham khảo.',
    },
  ],
};


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
    const admin = role === 'admin';
    const email = identity || (admin ? 'admin@hcmut.edu.vn' : teacher ? 'giangvien@hcmut.edu.vn' : 'sinhvien@hcmut.edu.vn');
    const name = admin ? 'Quản trị G4LMS' : teacher ? 'Nguyễn Văn Hùng' : 'Nguyễn Anh';
    return wait({ id: admin ? 'usr-admin-demo' : 'usr-demo', name, initials: admin ? 'QT' : teacher ? 'NH' : 'NA', email, role, accessToken: 'demo-access-token' });
  },
  getAdminUsers: (): Promise<AdminUser[]> => wait(adminUsers.filter((user) => user.active).map((user) => ({ ...user }))),
  createAdminUser(input: { email: string; fullName: string; role: Role }): Promise<AdminUser> {
    if (adminUsers.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
      return Promise.reject(new Error('Email đã được sử dụng.'));
    }
    const user: AdminUser = {
      id: `usr-${Date.now()}`,
      email: input.email,
      name: input.fullName,
      role: input.role,
      createdAt: new Date().toISOString(),
      active: true,
    };
    adminUsers.unshift(user);
    return wait({ ...user });
  },
  resetAdminUserPassword(userId: string): Promise<void> {
    if (!adminUsers.some((user) => user.id === userId && user.active)) {
      return Promise.reject(new Error('Không tìm thấy tài khoản.'));
    }
    return wait(undefined);
  },
  deleteAdminUser(userId: string): Promise<void> {
    const target = adminUsers.find((user) => user.id === userId);
    if (!target || target.role === 'admin') return Promise.reject(new Error('Không thể xóa tài khoản này.'));
    target.active = false;
    return wait(undefined);
  },
  getAdminEnrollments(): Promise<{
    students: AdminStudentOption[];
    courses: AdminCourseOption[];
    enrollments: AdminEnrollment[];
  }> {
    const students = adminUsers.filter((user) => user.active && user.role === 'student')
      .map(({ id, name, email }) => ({ id, name, email }));
    const courses = data.teacherCourses.map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      semester: 'HK261',
      year: 2026,
    }));
    return wait({ students, courses, enrollments: adminEnrollments.map((enrollment) => ({ ...enrollment })) });
  },
  createAdminEnrollment(input: { studentId: string; courseId: string }): Promise<AdminEnrollment> {
    const student = adminUsers.find((user) => user.id === input.studentId && user.role === 'student' && user.active);
    const course = data.teacherCourses.find((item) => item.id === input.courseId);
    if (!student || !course) return Promise.reject(new Error('Không tìm thấy sinh viên hoặc khóa học.'));
    if (adminEnrollments.some((item) => item.studentId === input.studentId && item.courseId === input.courseId)) {
      return Promise.reject(new Error('Sinh viên đã được ghi danh khóa học này.'));
    }
    const enrollment: AdminEnrollment = {
      id: `enr-${Date.now()}`,
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
      enrolledAt: new Date().toISOString(),
      progress: 0,
    };
    adminEnrollments.unshift(enrollment);
    return wait({ ...enrollment });
  },
  deleteAdminEnrollment(enrollmentId: string): Promise<void> {
    const index = adminEnrollments.findIndex((item) => item.id === enrollmentId);
    if (index < 0) return Promise.reject(new Error('Không tìm thấy bản ghi ghi danh.'));
    adminEnrollments.splice(index, 1);
    return wait(undefined);
  },
  getAdminStats(): Promise<AdminStats> {
    const activeUsers = adminUsers.filter((u) => u.active);
    const teachersList = activeUsers
      .filter((u) => u.role === 'teacher')
      .map(({ id, name, email }) => ({ id, name, email }));
    return wait({
      students: activeUsers.filter((u) => u.role === 'student').length + teacherRoster.length,
      teachers: teachersList.length,
      admins: activeUsers.filter((u) => u.role === 'admin').length,
      courses: data.teacherCourses.length,
      enrollments: adminEnrollments.length + teacherRoster.length,
      assignments: assignments.length,
      announcements: adminAnnouncements.length + courseAnnouncements.length,
      teachersList,
    });
  },
  getAdminCourses(): Promise<AdminCourseRecord[]> {
    const defaultTeacher = adminUsers.find((u) => u.role === 'teacher' && u.active);
    return wait(
      data.teacherCourses.map((course) => ({
        id: course.id,
        code: course.code,
        title: course.title,
        description: course.description ?? 'Học phần thuộc chương trình đào tạo chuẩn G4LMS.',
        faculty: course.faculty,
        semester: course.semester ?? 'HK261',
        year: course.year ?? 2026,
        theme: course.theme,
        published: course.published,
        lecturerId: defaultTeacher?.id ?? 'usr-teacher-demo',
        lecturerName: defaultTeacher?.name ?? 'Nguyễn Văn Hùng',
        students: course.students,
      })),
    );
  },
  createAdminCourse(input: {
    code: string;
    title: string;
    description?: string;
    faculty: string;
    semester?: string;
    year?: number;
    theme?: TeacherCourse['theme'];
    published?: boolean;
    lecturerId?: string | null;
  }): Promise<AdminCourseRecord> {
    if (data.teacherCourses.some((item) => item.code.toLowerCase() === input.code.toLowerCase())) {
      return Promise.reject(new Error('Khóa học với mã này đã tồn tại.'));
    }
    const teacher = adminUsers.find((u) => u.id === input.lecturerId && u.role === 'teacher');
    const created: TeacherCourse = {
      id: input.code.toUpperCase(),
      code: input.code.toUpperCase(),
      title: input.title,
      description: input.description ?? '',
      faculty: input.faculty,
      semester: input.semester ?? 'HK261',
      year: input.year ?? 2026,
      theme: input.theme ?? 'blue',
      students: 0,
      published: input.published ?? true,
      nodesWithContent: 0,
      totalNodes: 0,
    };
    data.teacherCourses.unshift(created);
    return wait({
      id: created.id,
      code: created.code,
      title: created.title,
      description: created.description ?? '',
      faculty: created.faculty,
      semester: created.semester ?? 'HK261',
      year: created.year ?? 2026,
      theme: created.theme,
      published: created.published,
      lecturerId: teacher?.id ?? null,
      lecturerName: teacher?.name ?? '',
      students: 0,
      createdAt: new Date().toISOString(),
    });
  },
  updateAdminCourse(courseId: string, input: UpdateTeacherCourseInput): Promise<AdminCourseRecord> {
    const course = data.teacherCourses.find((item) => item.id === courseId);
    if (!course) return Promise.reject(new Error('Không tìm thấy khóa học.'));
    if (input.code !== undefined) course.code = input.code;
    if (input.title !== undefined) course.title = input.title;
    if (input.description !== undefined) course.description = input.description;
    if (input.faculty !== undefined) course.faculty = input.faculty;
    if (input.semester !== undefined) course.semester = input.semester;
    if (input.year !== undefined) course.year = input.year;
    if (input.theme !== undefined) course.theme = input.theme;
    if (input.published !== undefined) course.published = input.published;
    const teacher = adminUsers.find((u) => u.id === input.lecturerId && u.role === 'teacher');
    return wait({
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description ?? '',
      faculty: course.faculty,
      semester: course.semester ?? 'HK261',
      year: course.year ?? 2026,
      theme: course.theme,
      published: course.published,
      lecturerId: teacher?.id ?? input.lecturerId ?? 'usr-teacher-demo',
      lecturerName: teacher?.name ?? 'Nguyễn Văn Hùng',
      students: course.students,
    });
  },
  deleteAdminCourse(courseId: string): Promise<void> {
    const index = data.teacherCourses.findIndex((item) => item.id === courseId);
    if (index < 0) return Promise.reject(new Error('Không tìm thấy khóa học.'));
    data.teacherCourses.splice(index, 1);
    return wait(undefined);
  },
  getAdminAnnouncements(): Promise<AdminAnnouncementRecord[]> {
    const courseItems: AdminAnnouncementRecord[] = courseAnnouncements.map((item) => ({
      id: item.id,
      courseId: item.courseId,
      courseName: item.courseId,
      title: item.title,
      body: item.body,
      status: item.status,
      isGlobal: false,
      authorName: 'Giảng viên',
      createdAt: item.createdAt,
      publishedAt: item.publishedAt ?? null,
    }));
    return wait([...adminAnnouncements, ...courseItems]);
  },
  createAdminAnnouncement(input: {
    title: string;
    body: string;
    courseId?: string | null;
    isGlobal?: boolean;
    status?: 'draft' | 'published';
  }): Promise<AdminAnnouncementRecord> {
    const now = new Date().toISOString();
    const isGlobal = input.isGlobal ?? !input.courseId;
    const course = data.teacherCourses.find((c) => c.id === input.courseId);
    const record: AdminAnnouncementRecord = {
      id: `ann-admin-${Date.now()}`,
      courseId: isGlobal ? null : (input.courseId ?? null),
      courseName: isGlobal ? 'Toàn trường' : (course ? `${course.code} - ${course.title}` : (input.courseId ?? 'Khóa học')),
      title: input.title.trim(),
      body: input.body.trim(),
      status: input.status ?? 'published',
      isGlobal,
      authorName: 'Quản trị G4LMS',
      createdAt: now,
      publishedAt: (input.status ?? 'published') === 'published' ? now : null,
    };
    adminAnnouncements.unshift(record);
    return wait({ ...record });
  },
  updateAdminAnnouncement(
    announcementId: string,
    input: { title?: string; body?: string; status?: 'draft' | 'published'; isGlobal?: boolean },
  ): Promise<AdminAnnouncementRecord> {
    const target = adminAnnouncements.find((item) => item.id === announcementId);
    if (!target) return Promise.reject(new Error('Không tìm thấy thông báo.'));
    if (input.title !== undefined) target.title = input.title.trim();
    if (input.body !== undefined) target.body = input.body.trim();
    if (input.status !== undefined) {
      target.status = input.status;
      target.publishedAt = input.status === 'published' ? new Date().toISOString() : null;
    }
    if (input.isGlobal !== undefined) target.isGlobal = input.isGlobal;
    return wait({ ...target });
  },
  deleteAdminAnnouncement(announcementId: string): Promise<void> {
    const index = adminAnnouncements.findIndex((item) => item.id === announcementId);
    if (index >= 0) {
      adminAnnouncements.splice(index, 1);
      return wait(undefined);
    }
    const courseIdx = courseAnnouncements.findIndex((item) => item.id === announcementId);
    if (courseIdx >= 0) {
      courseAnnouncements.splice(courseIdx, 1);
      return wait(undefined);
    }
    return Promise.reject(new Error('Không tìm thấy thông báo.'));
  },
  getHomeAnnouncements(): Promise<AdminAnnouncementRecord[]> {
    return wait(adminAnnouncements.filter((item) => item.status === 'published').map((item) => ({ ...item })));
  },

  getDashboard: (): Promise<DashboardData> => wait({
    activities: dashboardActivities,
    calendarEvents,
  }),
  getHomeSlides: (): Promise<HomeSlide[]> => wait(homepageSlides),
  getLoginHeroStats: (): Promise<LoginHeroStat[]> => wait(loginHeroStats),
  getProfileDetails: (role: Role): Promise<ProfileDetails> =>
    wait(role === 'teacher' ? profileDetails.teacher : profileDetails.student),
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
      ...input,
      id: input.code,
      theme: input.theme ?? 'orange',
      students: 0,
      published: false,
      nodesWithContent: 0,
      totalNodes: 0,
    };
    data.teacherCourses.unshift(course);
    return wait(course);
  },
  updateTeacherCourse(courseId: string, input: UpdateTeacherCourseInput): Promise<TeacherCourse> {
    const course = data.teacherCourses.find((item) => item.id === courseId);
    if (!course) return Promise.reject(new Error('Không tìm thấy khóa học.'));
    if (input.code !== undefined) course.code = input.code;
    if (input.title !== undefined) course.title = input.title;
    if (input.description !== undefined) course.description = input.description;
    if (input.faculty !== undefined) course.faculty = input.faculty;
    if (input.semester !== undefined) course.semester = input.semester;
    if (input.year !== undefined) course.year = input.year;
    if (input.theme !== undefined) course.theme = input.theme;
    if (input.published !== undefined) course.published = input.published;
    return wait({ ...course });
  },
  deleteTeacherCourse(courseId: string): Promise<void> {
    const index = data.teacherCourses.findIndex((item) => item.id === courseId);
    if (index < 0) return Promise.reject(new Error('Không tìm thấy khóa học.'));
    data.teacherCourses.splice(index, 1);
    return wait(undefined);
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
  deleteAttendanceSession(courseId: string, sessionId: string): Promise<void> {
    const index = attendanceSessions.findIndex((item) => item.courseId === courseId && item.id === sessionId);
    if (index < 0) return Promise.reject(new Error('Không tìm thấy buổi điểm danh.'));
    attendanceSessions.splice(index, 1);
    return wait(undefined);
  },
  getTeacherRoster: (_courseId: string) =>
    wait(
      teacherRoster.map((student) => ({
        ...student,
        email: student.email ?? `${student.id}@hcmut.edu.vn`,
        enrolledAt: student.enrolledAt ?? '2026-09-01T08:00:00Z',
      })),
    ),
  getTeacherGradebook: (_courseId: string): Promise<TeacherGradeRow[]> => wait(teacherGradebook),
  updateTeacherGradebookRow(
    _courseId: string,
    studentId: string,
    input: UpdateGradebookRowInput,
  ): Promise<TeacherGradeRow> {
    const row = teacherGradebook.find((item) => item.id === studentId);
    if (!row) return Promise.reject(new Error('Không tìm thấy sinh viên trong bảng điểm.'));
    row.midterm = input.midterm;
    row.project = input.project;
    row.final = input.final;
    row.attendance = input.attendance;
    row.totalScore =
      row.midterm !== null && row.project !== null && row.final !== null && row.attendance !== null
        ? Number((row.midterm * 0.3 + row.project * 0.25 + row.final * 0.35 + (row.attendance / 10) * 0.1).toFixed(1))
        : null;
    return wait({ ...row });
  },
  getTeacherCourseTopics: (_courseId: string): Promise<TeacherCourseTopic[]> => wait(teacherCourseTopics),
  getAssignments(courseId: string, role: Role): Promise<Assignment[]> {
    const rows = assignments
      .filter((item) => item.courseId === courseId && (role === 'teacher' || item.status === 'published'))
      .map((item) => {
        const subs = assignmentSubmissions[item.id] ?? [];
        return {
          ...item,
          submissionCount: subs.length,
          gradedCount: subs.filter((s) => s.score !== null).length,
        };
      });
    return wait(rows);
  },
  getAnnouncements(courseId: string, role: Role): Promise<Announcement[]> {
    return wait(courseAnnouncements.filter((item) => item.courseId === courseId && (role === 'teacher' || item.status === 'published')));
  },
  createAnnouncement(courseId: string, input: CreateAnnouncementInput): Promise<Announcement> {
    const now = new Date().toISOString();
    const item: Announcement = {
      ...input,
      id: `ann-${Date.now()}`,
      courseId,
      status: 'draft',
      authorName: 'Nguyễn Văn Hùng',
      createdAt: now,
    };
    courseAnnouncements.unshift(item);
    return wait(item);
  },
  updateAnnouncementStatus(courseId: string, announcementId: string, status: Announcement['status']): Promise<Announcement> {
    const item = courseAnnouncements.find((entry) => entry.courseId === courseId && entry.id === announcementId);
    if (!item) return Promise.reject(new Error('Không tìm thấy thông báo.'));
    item.status = status;
    item.publishedAt = status === 'published' ? new Date().toISOString() : undefined;
    return wait({ ...item });
  },
  updateAnnouncement(courseId: string, announcementId: string, input: UpdateAnnouncementInput): Promise<Announcement> {
    const item = courseAnnouncements.find((entry) => entry.courseId === courseId && entry.id === announcementId);
    if (!item) return Promise.reject(new Error('Không tìm thấy thông báo.'));
    if (input.title !== undefined) item.title = input.title.trim();
    if (input.body !== undefined) item.body = input.body.trim();
    if (input.status !== undefined) {
      item.status = input.status;
      item.publishedAt = input.status === 'published' ? (item.publishedAt ?? new Date().toISOString()) : undefined;
    }
    return wait({ ...item });
  },
  deleteAnnouncement(courseId: string, announcementId: string): Promise<void> {
    const index = courseAnnouncements.findIndex((entry) => entry.courseId === courseId && entry.id === announcementId);
    if (index < 0) return Promise.reject(new Error('Không tìm thấy thông báo.'));
    courseAnnouncements.splice(index, 1);
    return wait(undefined);
  },
  createAssignment(courseId: string, input: CreateAssignmentInput): Promise<Assignment> {
    const assignment: Assignment = {
      ...input,
      id: `asg-${Date.now()}`,
      courseId,
      status: 'draft',
      submissionCount: 0,
      gradedCount: 0,
    };
    assignments.unshift(assignment);
    return wait(assignment);
  },
  updateAssignmentStatus(courseId: string, assignmentId: string, status: Assignment['status']): Promise<Assignment> {
    const assignment = assignments.find((item) => item.courseId === courseId && item.id === assignmentId);
    if (!assignment) return Promise.reject(new Error('Không tìm thấy bài tập.'));
    assignment.status = status;
    return wait({ ...assignment });
  },
  updateAssignment(courseId: string, assignmentId: string, input: UpdateAssignmentInput): Promise<Assignment> {
    const assignment = assignments.find((item) => item.courseId === courseId && item.id === assignmentId);
    if (!assignment) return Promise.reject(new Error('Không tìm thấy bài tập.'));
    if (input.title !== undefined) assignment.title = input.title.trim();
    if (input.description !== undefined) assignment.description = input.description.trim();
    if (input.dueAt !== undefined) assignment.dueAt = input.dueAt;
    if (input.maxScore !== undefined) assignment.maxScore = input.maxScore;
    if (input.status !== undefined) assignment.status = input.status;
    return wait({ ...assignment });
  },
  deleteAssignment(courseId: string, assignmentId: string): Promise<void> {
    const index = assignments.findIndex((item) => item.courseId === courseId && item.id === assignmentId);
    if (index < 0) return Promise.reject(new Error('Không tìm thấy bài tập.'));
    assignments.splice(index, 1);
    return wait(undefined);
  },
  submitAssignment(courseId: string, assignmentId: string, input: SubmitAssignmentInput): Promise<Assignment> {
    const assignment = assignments.find((item) => item.courseId === courseId && item.id === assignmentId);
    if (!assignment || assignment.status !== 'published') return Promise.reject(new Error('Bài tập không khả dụng.'));
    const now = new Date().toISOString();
    assignment.submissionText = input.text;
    assignment.submissionStatus = 'submitted';
    assignment.submittedAt = now;
    const existingList = assignmentSubmissions[assignmentId] ?? [];
    const existing = existingList.find((item) => item.studentId === '2252001');
    if (existing) {
      existing.text = input.text;
      existing.submittedAt = now;
      existing.status = 'submitted';
    } else {
      existingList.unshift({
        id: `sub-${Date.now()}`,
        studentId: '2252001',
        studentName: 'Nguyễn Anh',
        text: input.text,
        submittedAt: now,
        status: 'submitted',
        score: null,
        feedback: null,
      });
    }
    assignmentSubmissions[assignmentId] = existingList;
    return wait({ ...assignment });
  },
  getAssignmentSubmissions(_courseId: string, assignmentId: string): Promise<AssignmentSubmissionRecord[]> {
    return wait((assignmentSubmissions[assignmentId] ?? []).map((item) => ({ ...item })));
  },
  gradeSubmission(
    courseId: string,
    assignmentId: string,
    submissionId: string,
    input: { score: number; feedback?: string | null },
  ): Promise<AssignmentSubmissionRecord> {
    const assignment = assignments.find((item) => item.courseId === courseId && item.id === assignmentId);
    if (!assignment) return Promise.reject(new Error('Không tìm thấy bài tập.'));
    if (input.score < 0 || input.score > assignment.maxScore) {
      return Promise.reject(new Error('Điểm không hợp lệ.'));
    }
    const list = assignmentSubmissions[assignmentId] ?? [];
    const target = list.find((item) => item.id === submissionId);
    if (!target) return Promise.reject(new Error('Không tìm thấy bài nộp.'));
    target.score = input.score;
    target.feedback = input.feedback ?? null;
    target.status = 'graded';
    if (target.studentId === '2252001') {
      assignment.score = input.score;
      assignment.feedback = input.feedback ?? null;
      assignment.submissionStatus = 'graded';
    }
    return wait({ ...target });
  },
  getStudentLearningProfile(courseId?: string): Promise<StudentLearningProfile> {
    const courses = data.studentCourses
      .filter((c) => !courseId || c.id === courseId)
      .map((c) => ({
        courseId: c.id,
        courseCode: c.code,
        courseTitle: c.title,
        progress: c.progress,
        gap: c.gap,
        totalNodes: 12,
        masteredNodes: Math.round((c.progress / 100) * 12),
        inProgressNodes: 3,
        averageMastery: c.progress,
      }));
    const graph = courseId === 'CO3093' ? data.computerNetworksOverview : data.studentOverview;
    const knowledgeGaps = graph.nodes
      .filter((n) => (n.mastery ?? 0) < 80)
      .slice(0, 6)
      .map((n) => ({
        id: n.id,
        title: n.label,
        courseId: courseId ?? 'CO3093',
        courseCode: courseId ?? 'CO3093',
        cluster: n.sub ?? 'Trọng tâm',
        mastery: n.mastery ?? 40,
        lo: n.lo ?? 'LO1',
      }));
    return wait({
      studentId: '2252001',
      overallProgress: courses.length ? Math.round(courses.reduce((s, c) => s + c.progress, 0) / courses.length) : 0,
      courses,
      knowledgeGaps,
    });
  },
  getCourseRecommendations(courseId: string): Promise<CourseRecommendation[]> {
    const graph = courseId === 'CO3093' ? data.computerNetworksOverview : data.studentOverview;
    const items: CourseRecommendation[] = graph.nodes
      .filter((n) => (n.mastery ?? 0) < 80)
      .slice(0, 5)
      .map((n, index) => ({
        nodeId: n.id,
        title: n.label,
        subtitle: n.sub,
        clusterName: n.tag ?? 'Cụm kiến thức trọng tâm',
        learningOutcomeId: n.lo ?? 'LO2',
        currentMastery: n.mastery ?? 35,
        aiHint: `Ôn tập khái niệm ${n.label} và hoàn thành bài quiz ngắn để nâng mức thành thạo lên trên 80%.`,
        score: Number((0.92 - index * 0.08).toFixed(2)),
        reason: (n.mastery ?? 0) === 0
          ? 'Sẵn sàng học mới — đã hoàn thành các kiến thức tiền đề.'
          : `Độ thành thạo hiện tại ${n.mastery ?? 35}% — cần củng cố để mở khóa chủ đề tiếp theo.`,
      }));
    return wait(items);
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

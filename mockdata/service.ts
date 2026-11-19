import type {
  AdminAnnouncementRecord, AdminCourseOption, AdminCourseRecord, AdminEnrollment, AdminStats, AdminStudentOption, AdminUser, Announcement, Assignment, AssignmentSubmissionRecord, AttendanceSession, ChapterLessonItem, ClusterView, ConversationMessage, ConversationSummary,
  CourseFile, CourseOutlineData, CourseOverallGrade, CourseRecommendation, CourseRelationItem, CreateAnnouncementInput, CreateAssignmentInput, CreateAttendanceSessionInput,
  CreateConversationInput, CreateQuizInput, CreateTeacherCourseInput, DashboardData, HeatSpot, HomeSlide,
  KnowledgeEdgeType, KnowledgeGraphData, KnowledgeGraphEdge, KnowledgeGraphNode, KnowledgeNodeType,
  LearningOutcome, LoginHeroStat, MessageContact, MessagePreview, NodeDetail, NodeEditorData,
  NotificationRecord, OutlineDraftResponse, OutlineState, PdfFile, ProfileDetails, PublishCourseResponse, QueueSummary, Quiz, QuizAttempt, ReviewDecision, Role, StudentAttendanceData,
  StudentCourse, StudentGradeItem, StudentGraph, StudentLearningProfile, SubmitAssignmentInput, SubmitQuizInput, TeacherCourse,
  TeacherCourseTopic, TeacherGradeRow, TeacherGraphData, UpdateAnnouncementInput, UpdateAssignmentInput, UpdateAttendanceSessionInput, UpdateGradebookRowInput, UpdateTeacherCourseInput, User, WorkflowJobResponse,
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

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota or private mode errors
  }
}

const attempts = new Map<string, QuizAttempt>();
const clusterViewStore = new Map<string, ClusterView>();

const rawKg = loadStorage<Record<string, KnowledgeGraphData>>('g4lms.mock.knowledgeGraphs', {});
const knowledgeGraphStore = new Map<string, KnowledgeGraphData>(Object.entries(rawKg));

function persistKnowledgeGraph(): void {
  const obj: Record<string, KnowledgeGraphData> = {};
  for (const [id, kg] of knowledgeGraphStore.entries()) {
    obj[id] = kg;
  }
  saveStorage('g4lms.mock.knowledgeGraphs', obj);
}

const teacherCoursesStore: TeacherCourse[] = loadStorage<TeacherCourse[]>(
  'g4lms.mock.teacherCourses',
  data.teacherCourses.map((c) => ({ ...c })),
);

function persistTeacherCourses(): void {
  saveStorage('g4lms.mock.teacherCourses', teacherCoursesStore);
}

const studentCoursesStore: StudentCourse[] = loadStorage<StudentCourse[]>(
  'g4lms.mock.studentCourses',
  data.studentCourses.map((c) => ({ ...c })),
);

function persistStudentCourses(): void {
  saveStorage('g4lms.mock.studentCourses', studentCoursesStore);
}

const uploadedFiles: CourseFile[] = loadStorage<CourseFile[]>('g4lms.mock.uploadedFiles', []);

function persistUploadedFiles(): void {
  saveStorage('g4lms.mock.uploadedFiles', uploadedFiles);
}

const pdfFilesStore: PdfFile[] = loadStorage<PdfFile[]>(
  'g4lms.mock.pdfFiles',
  data.pdfFiles.map((p) => ({ ...p })),
);

function persistPdfFiles(): void {
  saveStorage('g4lms.mock.pdfFiles', pdfFilesStore);
}

interface AuthoringState {
  outline: CourseOutlineData;
  outlineState: OutlineState;
  outlineRevision: number;
  lessonsByChapter: Record<string, ChapterLessonItem[]>;
  relations: CourseRelationItem[];
  relationRevision: number;
  masterVersion: number;
}

interface MockAuthoringJob {
  kind: 'outline' | 'lesson' | 'relation';
  courseId: string;
  chapterId?: string;
  chapterIds?: string[];
  idempotencyKey: string;
  polls: number;
  status: WorkflowJobResponse['status'];
  progress: number;
  canResume: boolean;
  resumeCount: number;
  maxResumeAttempts: number;
  revision: number;
}

const rawAuthoring = loadStorage<Record<string, AuthoringState>>('g4lms.mock.authoringState', {});
const authoringStore = new Map<string, AuthoringState>(Object.entries(rawAuthoring));
const authoringJobs = new Map<string, MockAuthoringJob>();

function persistAuthoring(): void {
  const obj: Record<string, AuthoringState> = {};
  for (const [id, st] of authoringStore.entries()) {
    obj[id] = st;
  }
  saveStorage('g4lms.mock.authoringState', obj);
}

function ensureAuthoringState(courseId: string): AuthoringState {
  if (!authoringStore.has(courseId)) {
    authoringStore.set(courseId, {
      outline: { chapters: [], learningOutcomes: [] },
      outlineState: 'DRAFT',
      outlineRevision: 1,
      lessonsByChapter: {},
      relations: [],
      relationRevision: 1,
      masterVersion: 0,
    });
    persistAuthoring();
  }
  return authoringStore.get(courseId)!;
}

function normalizeKnowledgeEdgeType(kind: string): KnowledgeEdgeType {
  if (kind === 'prereq' || kind === 'PREREQUISITE') return 'PREREQUISITE';
  if (kind === 'PART_OF') return 'PART_OF';
  if (kind === 'DEVELOP') return 'DEVELOP';
  if (kind === 'EXPLAIN') return 'EXPLAIN';
  if (kind === 'ASSESS') return 'ASSESS';
  return 'RELATED_TO';
}

function buildFallbackKnowledgeGraph(courseId: string): KnowledgeGraphData {
  const course =
    teacherCoursesStore.find((c) => c.id === courseId) ??
    studentCoursesStore.find((c) => c.id === courseId);
  const courseTitle = course ? `${course.title} (${course.code})` : courseId;
  const base = courseId === 'CO3093' ? data.computerNetworksTeacherGraph : data.teacherGraph;
  const nodes: KnowledgeGraphNode[] = [
    {
      id: courseId,
      name: courseTitle,
      type: 'Course',
      description: `Đồ thị tri thức tổng hợp cho môn ${courseTitle}.`,
      properties: { code: course?.code ?? courseId },
    },
  ];
  const edges: KnowledgeGraphEdge[] = [];
  const nodeIds = new Set<string>([courseId]);

  const addNode = (node: KnowledgeGraphNode) => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };

  data.learningOutcomes.forEach((lo) => {
    const loId = `${courseId}.${lo.id}`;
    addNode({
      id: loId,
      name: lo.title,
      type: 'LO',
      description: `Chuẩn đầu ra ${lo.id} của môn ${courseTitle}.`,
      properties: { code: lo.id },
    });
    edges.push({ source: loId, target: courseId, type: 'DEVELOP', properties: { status: 'approved', confidence: 0.96 } });
  });

  base.clusters.forEach((cluster) => {
    const chapterId = `ch${cluster.index}`;
    const clusterNodeId = `${courseId}_${cluster.id}`;
    addNode({
      id: clusterNodeId,
      name: cluster.name,
      type: 'Concept',
      description: `Chủ đề trọng tâm #${cluster.index}: ${cluster.name} (${cluster.nodeCount} khái niệm thành phần).`,
      properties: {
        chapter_id: chapterId,
        status: cluster.approved ? 'approved' : 'proposed',
        node_count: cluster.nodeCount,
      },
    });
    cluster.lo.forEach((loCode) => {
      const loId = `${courseId}.${loCode}`;
      if (nodeIds.has(loId)) {
        edges.push({
          source: clusterNodeId,
          target: loId,
          type: 'DEVELOP',
          properties: {
            status: cluster.approved ? 'approved' : 'proposed',
            confidence: cluster.approved ? 0.92 : 0.72,
            reason: `Chủ đề ${cluster.name} phát triển trực tiếp chuẩn đầu ra ${loCode}.`,
          },
        });
      }
    });

    const inner = data.buildClusterView(cluster.id);
    inner.nodes
      .filter((n) => !n.ghost)
      .forEach((innerNode, idx) => {
        const subId = `${courseId}_${innerNode.id}`;
        addNode({
          id: subId,
          name: innerNode.name,
          type: 'Concept',
          description: `Khái niệm thuộc chủ đề ${cluster.name}.`,
          properties: {
            chapter_id: chapterId,
            status: innerNode.status === 'approved' ? 'approved' : 'proposed',
          },
        });
        edges.push({
          source: subId,
          target: clusterNodeId,
          type: 'PART_OF',
          properties: {
            status: innerNode.status === 'approved' ? 'approved' : 'proposed',
            confidence: innerNode.status === 'approved' ? 0.94 : 0.71,
            reason: `${innerNode.name} là khái niệm con thuộc ${cluster.name}.`,
          },
        });

        const slideId = `${subId}_slide_${idx + 1}`;
        addNode({
          id: slideId,
          name: `Slide ${cluster.index}.${idx + 1}: ${innerNode.name}`,
          type: 'Content',
          description: `Tài liệu bài giảng giải thích chi tiết khái niệm ${innerNode.name}.`,
          properties: { chapter_id: chapterId, page: idx + 1 },
        });
        edges.push({
          source: slideId,
          target: subId,
          type: 'EXPLAIN',
          properties: { status: 'approved', confidence: 0.9 },
        });
      });

    inner.edges.forEach((edge) => {
      const s = `${courseId}_${edge.from}`;
      const t = `${courseId}_${edge.to}`;
      if (nodeIds.has(s) && nodeIds.has(t)) {
        edges.push({
          source: s,
          target: t,
          type: edge.kind === 'prereq' ? 'PREREQUISITE' : 'RELATED_TO',
          properties: {
            status: edge.kind === 'prereq' ? 'approved' : 'proposed',
            confidence: edge.kind === 'prereq' ? 0.88 : 0.74,
            reason: 'Quan hệ được AI trích xuất từ giáo trình môn học.',
          },
        });
      }
    });
  });

  base.clusterEdges.forEach((edge, idx) => {
    const s = `${courseId}_${edge.from}`;
    const t = `${courseId}_${edge.to}`;
    if (nodeIds.has(s) && nodeIds.has(t)) {
      edges.push({
        source: s,
        target: t,
        type: edge.kind === 'prereq' ? 'PREREQUISITE' : 'RELATED_TO',
        properties: {
          status: idx % 4 === 0 ? 'proposed' : 'approved',
          confidence: idx % 4 === 0 ? 0.73 : 0.91,
          reason:
            edge.kind === 'prereq'
              ? 'Cần nắm chủ đề trước để tiếp thu hiệu quả chủ đề sau.'
              : 'Hai chủ đề có mối liên hệ chéo trong chương trình.',
        },
      });
    }
  });

  const courseAssignments = assignments.filter((a) => a.courseId === courseId);
  courseAssignments.forEach((asg, idx) => {
    addNode({
      id: asg.id,
      name: asg.title,
      type: 'Assignment',
      description: asg.description,
      properties: { kind: 'assignment', status: asg.status },
    });
    const lo = data.learningOutcomes[idx % data.learningOutcomes.length];
    if (lo) {
      edges.push({
        source: asg.id,
        target: `${courseId}.${lo.id}`,
        type: 'DEVELOP',
        properties: { status: 'approved', confidence: 0.9 },
      });
    }
    const targetCluster = base.clusters[idx % base.clusters.length];
    if (targetCluster) {
      edges.push({
        source: asg.id,
        target: `${courseId}_${targetCluster.id}`,
        type: 'ASSESS',
        properties: { status: 'approved', confidence: 0.89 },
      });
    }
  });

  return { nodes, edges };
}

async function ensureKnowledgeGraph(courseId: string, forceGenerate = false): Promise<KnowledgeGraphData> {
  const normId = courseId.trim();
  if (!forceGenerate && knowledgeGraphStore.has(normId)) {
    const existing = knowledgeGraphStore.get(normId)!;
    const course = teacherCoursesStore.find((c) => c.id === normId || c.code.toLowerCase() === normId.toLowerCase());
    if (course && course.totalNodes === 0) {
      return { nodes: [], edges: [] };
    }
    if (!existing.nodes.some((n) => n.type !== 'Course')) {
      return { nodes: [], edges: [] };
    }
    return existing;
  }

  // Pre-configured demo courses
  if (normId === 'CO3093' && typeof fetch === 'function') {
    try {
      const response = await fetch('/mockdata/prototypeGraph.json');
      if (response.ok) {
        const raw = (await response.json()) as KnowledgeGraphData;
        const cloned: KnowledgeGraphData = {
          nodes: raw.nodes.map((n) => ({ ...n, properties: { ...(n.properties ?? {}) } })),
          edges: raw.edges.map((e) => ({ ...e, properties: { ...(e.properties ?? {}) } })),
        };
        knowledgeGraphStore.set(normId, cloned);
        persistKnowledgeGraph();
        return cloned;
      }
    } catch {
      // Fallback
    }
  }

  if (normId === 'CO2003') {
    const built = buildFallbackKnowledgeGraph(normId);
    knowledgeGraphStore.set(normId, built);
    persistKnowledgeGraph();
    return built;
  }

  // If AI generation is explicitly triggered from PDF upload
  if (forceGenerate) {
    const built = buildFallbackKnowledgeGraph(normId);
    knowledgeGraphStore.set(normId, built);
    persistKnowledgeGraph();
    return built;
  }

  // ALL other newly created courses start EMPTY
  const empty: KnowledgeGraphData = { nodes: [], edges: [] };
  knowledgeGraphStore.set(normId, empty);
  persistKnowledgeGraph();
  return empty;
}

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
    const courses = teacherCoursesStore.map((course) => ({
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
    const course = teacherCoursesStore.find((item) => item.id === input.courseId);
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
      courses: teacherCoursesStore.length,
      enrollments: adminEnrollments.length + teacherRoster.length,
      assignments: assignments.length,
      announcements: adminAnnouncements.length + courseAnnouncements.length,
      teachersList,
    });
  },
  getAdminCourses(): Promise<AdminCourseRecord[]> {
    const defaultTeacher = adminUsers.find((u) => u.role === 'teacher' && u.active);
    return wait(
      teacherCoursesStore.map((course) => ({
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
    if (teacherCoursesStore.some((item) => item.code.toLowerCase() === input.code.toLowerCase())) {
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
    teacherCoursesStore.unshift(created);
    persistTeacherCourses();
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
    const course = teacherCoursesStore.find((item) => item.id === courseId);
    if (!course) return Promise.reject(new Error('Không tìm thấy khóa học.'));
    if (input.code !== undefined) course.code = input.code;
    if (input.title !== undefined) course.title = input.title;
    if (input.description !== undefined) course.description = input.description;
    if (input.faculty !== undefined) course.faculty = input.faculty;
    if (input.semester !== undefined) course.semester = input.semester;
    if (input.year !== undefined) course.year = input.year;
    if (input.theme !== undefined) course.theme = input.theme;
    if (input.published !== undefined) course.published = input.published;
    persistTeacherCourses();
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
    const index = teacherCoursesStore.findIndex((item) => item.id === courseId);
    if (index < 0) return Promise.reject(new Error('Không tìm thấy khóa học.'));
    teacherCoursesStore.splice(index, 1);
    persistTeacherCourses();
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
    const course = teacherCoursesStore.find((c) => c.id === input.courseId);
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
  getStudentCourses: (): Promise<StudentCourse[]> => wait(studentCoursesStore.map((c) => ({ ...c }))),
  getTeacherCourses: (): Promise<TeacherCourse[]> => wait(teacherCoursesStore.map((c) => ({ ...c }))),
  createTeacherCourse(input: CreateTeacherCourseInput): Promise<TeacherCourse> {
    const code = input.code.trim().toUpperCase();
    if (teacherCoursesStore.some((item) => item.code.toUpperCase() === code || item.id === code)) {
      return Promise.reject(new Error('Khóa học với mã này đã tồn tại.'));
    }
    const course: TeacherCourse = {
      ...input,
      id: code,
      code,
      theme: input.theme ?? 'orange',
      students: 0,
      published: false,
      nodesWithContent: 0,
      totalNodes: 0,
    };
    teacherCoursesStore.unshift(course);
    persistTeacherCourses();

    const studentCourse: StudentCourse = {
      id: code,
      code,
      title: input.title,
      description: input.description ?? '',
      lecturer: 'Nguyễn Văn Hùng',
      semester: input.semester ?? 'HK1',
      year: input.year ?? 2026,
      theme: input.theme ?? 'orange',
      faculty: input.faculty,
      progress: 0,
      gap: 'Chưa có dữ liệu',
      deadline: 'Tuần này',
    };
    if (!studentCoursesStore.some((s) => s.id === code)) {
      studentCoursesStore.unshift(studentCourse);
      persistStudentCourses();
    }

    return wait({ ...course });
  },
  updateTeacherCourse(courseId: string, input: UpdateTeacherCourseInput): Promise<TeacherCourse> {
    const course = teacherCoursesStore.find((item) => item.id === courseId);
    if (!course) return Promise.reject(new Error('Không tìm thấy khóa học.'));
    if (input.code !== undefined) course.code = input.code;
    if (input.title !== undefined) course.title = input.title;
    if (input.description !== undefined) course.description = input.description;
    if (input.faculty !== undefined) course.faculty = input.faculty;
    if (input.semester !== undefined) course.semester = input.semester;
    if (input.year !== undefined) course.year = input.year;
    if (input.theme !== undefined) course.theme = input.theme;
    if (input.published !== undefined) course.published = input.published;
    persistTeacherCourses();

    const sc = studentCoursesStore.find((s) => s.id === courseId);
    if (sc) {
      if (input.code !== undefined) sc.code = input.code;
      if (input.title !== undefined) sc.title = input.title;
      if (input.theme !== undefined) sc.theme = input.theme;
      persistStudentCourses();
    }

    return wait({ ...course });
  },
  deleteTeacherCourse(courseId: string): Promise<void> {
    const index = teacherCoursesStore.findIndex((item) => item.id === courseId);
    if (index < 0) return Promise.reject(new Error('Không tìm thấy khóa học.'));
    teacherCoursesStore.splice(index, 1);
    persistTeacherCourses();

    const sIndex = studentCoursesStore.findIndex((s) => s.id === courseId);
    if (sIndex >= 0) {
      studentCoursesStore.splice(sIndex, 1);
      persistStudentCourses();
    }

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
  async getKnowledgeGraph(courseId: string): Promise<KnowledgeGraphData> {
    const kg = await ensureKnowledgeGraph(courseId);
    return wait({
      nodes: kg.nodes.map((n) => ({ ...n, properties: { ...(n.properties ?? {}) } })),
      edges: kg.edges.map((e) => ({ ...e, properties: { ...(e.properties ?? {}) } })),
    }, 60);
  },
  async generateKnowledgeGraph(courseId: string): Promise<KnowledgeGraphData> {
    const generated = await ensureKnowledgeGraph(courseId, true);
    // Mark nodes and edges as proposed/draft as per FR01 / Bảng 2.2.7
    generated.nodes.forEach((n) => {
      if (n.type !== 'Course') {
        n.properties = { ...(n.properties ?? {}), status: 'proposed' };
      }
    });
    generated.edges.forEach((e) => {
      e.properties = { ...(e.properties ?? {}), status: 'proposed' };
    });
    knowledgeGraphStore.set(courseId, generated);
    persistKnowledgeGraph();
    const course = teacherCoursesStore.find((c) => c.id === courseId);
    if (course) {
      course.totalNodes = generated.nodes.length;
      course.nodesWithContent = Math.floor(generated.nodes.length * 0.75);
      course.pending = generated.edges.filter((e) => e.properties?.status === 'proposed').length;
      persistTeacherCourses();
    }
    return wait({
      nodes: generated.nodes.map((n) => ({ ...n, properties: { ...(n.properties ?? {}) } })),
      edges: generated.edges.map((e) => ({ ...e, properties: { ...(e.properties ?? {}) } })),
    }, 150);
  },
  getCourseGraph(courseId: string): Promise<TeacherGraphData> {
    const base = courseId === 'CO3093' ? data.computerNetworksTeacherGraph : data.teacherGraph;
    return wait({
      stats: { ...base.stats },
      clusters: base.clusters.map((c) => ({ ...c, lo: [...c.lo] })),
      clusterEdges: base.clusterEdges.map((e) => ({ ...e })),
    });
  },
  getTeacherGraph(courseId: string): Promise<TeacherGraphData> {
    return this.getCourseGraph(courseId);
  },
  getCourseClusterView(_courseId: string, clusterId: string): Promise<ClusterView> {
    return this.getClusterView(clusterId);
  },
  getClusterView(clusterId: string): Promise<ClusterView> {
    if (!clusterViewStore.has(clusterId)) {
      const built = data.buildClusterView(clusterId);
      clusterViewStore.set(clusterId, {
        nodes: built.nodes.map((n) => ({ ...n, lo: n.lo ? [...n.lo] : undefined })),
        edges: built.edges.map((e) => ({ ...e })),
      });
    }
    const view = clusterViewStore.get(clusterId)!;
    return wait({
      nodes: view.nodes.map((n) => ({ ...n, lo: n.lo ? [...n.lo] : undefined })),
      edges: view.edges.map((e) => ({ ...e })),
    });
  },
  async createGraphNode(
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
  ): Promise<Record<string, unknown>> {
    const kg = await ensureKnowledgeGraph(courseId);
    const nodeType: KnowledgeNodeType = input.nodeType ?? 'Concept';
    const id = `${String(nodeType).toLowerCase()}_${Date.now()}`;
    const newKgNode: KnowledgeGraphNode = {
      id,
      name: input.name.trim(),
      type: nodeType,
      description: input.description?.trim() ?? '',
      properties: { status: 'approved', custom: true, ...(input.properties ?? {}) },
    };
    kg.nodes.push(newKgNode);
    if (nodeType === 'LO') {
      const courseRoot = kg.nodes.find((n) => n.type === 'Course');
      if (courseRoot) {
        kg.edges.push({ source: id, target: courseRoot.id, type: 'DEVELOP', properties: { status: 'approved', confidence: 1 } });
      }
    } else if (input.clusterId && kg.nodes.some((n) => n.id === input.clusterId)) {
      const parent = kg.nodes.find((n) => n.id === input.clusterId);
      const rel: KnowledgeEdgeType = parent?.type === 'LO' ? 'DEVELOP' : 'PART_OF';
      kg.edges.push({ source: id, target: input.clusterId, type: rel, properties: { status: 'approved', confidence: 1 } });
    }
    persistKnowledgeGraph();
    return wait({ ...newKgNode });
  },
  async updateGraphNode(
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
  ): Promise<Record<string, unknown>> {
    const kg = await ensureKnowledgeGraph(courseId);
    const kgNode = kg.nodes.find((n) => n.id === nodeId);
    if (kgNode) {
      if (input.name !== undefined) kgNode.name = input.name.trim();
      if (input.description !== undefined) kgNode.description = input.description.trim();
      kgNode.properties = { ...(kgNode.properties ?? {}), ...(input.properties ?? {}) };
      if (input.status !== undefined) kgNode.properties.status = input.status;
      if (input.approved !== undefined) {
        kgNode.properties.approved = input.approved;
        if (input.approved) kgNode.properties.status = 'approved';
      }
      persistKnowledgeGraph();
      return wait({ ...kgNode });
    }
    const graph = courseId === 'CO3093' ? data.computerNetworksTeacherGraph : data.teacherGraph;
    const cluster = graph.clusters.find((c) => c.id === nodeId);
    if (cluster) {
      if (input.name !== undefined) cluster.name = input.name;
      if (input.approved !== undefined) cluster.approved = input.approved;
      if (input.lo !== undefined) cluster.lo = [...input.lo];
      return wait({ ...cluster });
    }
    for (const view of clusterViewStore.values()) {
      const node = view.nodes.find((n) => n.id === nodeId);
      if (node) {
        if (input.name !== undefined) node.name = input.name;
        if (input.status !== undefined && input.status !== 'proposed') node.status = input.status;
        if (input.lo !== undefined) node.lo = [...input.lo];
        return wait({ ...node });
      }
    }
    return Promise.reject(new Error('Không tìm thấy node hoặc cụm.'));
  },
  async deleteGraphNode(courseId: string, nodeId: string): Promise<void> {
    const kg = await ensureKnowledgeGraph(courseId);
    const target = kg.nodes.find((n) => n.id === nodeId);
    if (target?.type === 'Course') {
      return Promise.reject(new Error('Không thể xóa node gốc của khóa học.'));
    }
    kg.nodes = kg.nodes.filter((n) => n.id !== nodeId);
    kg.edges = kg.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    persistKnowledgeGraph();
    return wait(undefined);
  },
  async createGraphEdge(
    courseId: string,
    input: { fromId: string; toId: string; kind: string; clusterId?: string | null; properties?: Record<string, unknown> },
  ): Promise<{ from: string; to: string; kind: string; source: string; target: string; type: KnowledgeEdgeType }> {
    if (input.fromId === input.toId) return Promise.reject(new Error('Không thể nối cạnh tới chính node đó.'));
    const kg = await ensureKnowledgeGraph(courseId);
    if (!kg.nodes.some((n) => n.id === input.fromId) || !kg.nodes.some((n) => n.id === input.toId)) {
      return Promise.reject(new Error('Không tìm thấy node nguồn hoặc node đích trong đồ thị.'));
    }
    const edgeType = normalizeKnowledgeEdgeType(input.kind);
    if (edgeType === 'PREREQUISITE') {
      // Validate Graph Integrity (Bảng 2.2.10): forbid cycles on PREREQUISITE edges
      const visited = new Set<string>([input.toId]);
      const stack = [input.toId];
      while (stack.length) {
        const cur = stack.pop()!;
        if (cur === input.fromId) {
          return Promise.reject(
            new Error('Lỗi toàn vẹn đồ thị (Validate Graph Integrity): Cạnh PREREQUISITE này tạo chu trình vòng!'),
          );
        }
        for (const e of kg.edges) {
          if (e.type === 'PREREQUISITE' && e.source === cur && !visited.has(e.target)) {
            visited.add(e.target);
            stack.push(e.target);
          }
        }
      }
    }
    if (!kg.edges.some((e) => e.source === input.fromId && e.target === input.toId && e.type === edgeType)) {
      kg.edges.push({
        source: input.fromId,
        target: input.toId,
        type: edgeType,
        properties: { status: 'approved', confidence: 1, custom: true, ...(input.properties ?? {}) },
      });
    }
    persistKnowledgeGraph();
    return wait({
      from: input.fromId,
      to: input.toId,
      kind: input.kind,
      source: input.fromId,
      target: input.toId,
      type: edgeType,
    });
  },
  async deleteGraphEdge(
    courseId: string,
    input: { fromId: string; toId: string; edgeType?: string | null; clusterId?: string | null },
  ): Promise<void> {
    const kg = await ensureKnowledgeGraph(courseId);
    kg.edges = kg.edges.filter(
      (e) => !(e.source === input.fromId && e.target === input.toId && (!input.edgeType || e.type === input.edgeType)),
    );
    persistKnowledgeGraph();
    return wait(undefined);
  },
  async approveGraphEdge(
    courseId: string,
    input: { fromId: string; toId: string; edgeType?: string | null },
  ): Promise<void> {
    const kg = await ensureKnowledgeGraph(courseId);
    kg.edges.forEach((e) => {
      if (e.source === input.fromId && e.target === input.toId && (!input.edgeType || e.type === input.edgeType)) {
        e.properties = { ...(e.properties ?? {}), status: 'approved', confidence: 1 };
      }
    });
    persistKnowledgeGraph();
    return wait(undefined);
  },
  async mergeGraphNodes(
    courseId: string,
    input: { keepId: string; mergeId: string; clusterId?: string | null },
  ): Promise<{ id: string }> {
    if (input.keepId === input.mergeId) return Promise.reject(new Error('Hai node cần gộp phải khác nhau.'));
    const kg = await ensureKnowledgeGraph(courseId);
    const keepNode = kg.nodes.find((n) => n.id === input.keepId);
    const dupNode = kg.nodes.find((n) => n.id === input.mergeId);
    if (!keepNode || !dupNode) {
      return Promise.reject(new Error('Không tìm thấy node để gộp.'));
    }
    if (dupNode.type === 'Course') {
      return Promise.reject(new Error('Không thể gộp node gốc của khóa học.'));
    }
    const existingMerged = Array.isArray(keepNode.properties?.merged_from)
      ? (keepNode.properties?.merged_from as string[])
      : [];
    keepNode.properties = {
      ...(keepNode.properties ?? {}),
      merged_from: Array.from(new Set([...existingMerged, dupNode.name])),
    };
    const dedup = new Set<string>();
    kg.edges = kg.edges
      .map((e) => ({
        ...e,
        source: e.source === input.mergeId ? input.keepId : e.source,
        target: e.target === input.mergeId ? input.keepId : e.target,
      }))
      .filter((e) => {
        if (e.source === e.target) return false;
        const key = `${e.source}|${e.target}|${e.type}`;
        if (dedup.has(key)) return false;
        dedup.add(key);
        return true;
      });
    kg.nodes = kg.nodes.filter((n) => n.id !== input.mergeId);
    persistKnowledgeGraph();
    return wait({ id: input.keepId });
  },

  getReviewQueue: (_courseId: string): Promise<QueueSummary> => wait(data.reviewQueue),
  getHeatSpot: (clusterId?: string): Promise<HeatSpot> => wait(data.heatSpots[clusterId ?? ''] ?? data.heatSpots.pointer, 60),
  getCourseFiles(courseId: string): Promise<CourseFile[]> {
    const saved = pdfFilesStore
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
    persistUploadedFiles();
    if (item.mimeType === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const pdfItem: PdfFile = {
        ...item,
        pages: 0,
        sizeMb: Number((file.size / 1048576).toFixed(1)),
        date: new Intl.DateTimeFormat('vi-VN').format(new Date(uploadedAt)),
      };
      pdfFilesStore.unshift(pdfItem);
      persistPdfFiles();
    }
    return wait(item);
  },
  getCoursePdfs: (courseId: string): Promise<PdfFile[]> =>
    wait(pdfFilesStore.filter((file) => file.courseId === courseId)),
  getLoChains: (_courseId: string) => wait(data.loChains),
  getNodeEditor: (nodeId: string): Promise<NodeEditorData> => wait(data.buildNodeEditor(nodeId)),

  /* ==================== D1–D5 Authoring Workflow Mock ==================== */
  async uploadCourseSyllabus(courseId: string, file: File): Promise<{ syllabusId: string }> {
    await this.uploadCourseFile(courseId, file);
    return wait({ syllabusId: `syl-${courseId}-${Date.now()}` }, 120);
  },
  createOutlineJob(courseId: string, _syllabusId: string, idempotencyKey: string): Promise<{ jobId: string; status: string }> {
    const jobId = `job-outline-${courseId}-${Date.now()}`;
    const state = ensureAuthoringState(courseId);
    authoringJobs.set(jobId, {
      kind: 'outline',
      courseId,
      idempotencyKey,
      polls: 0,
      status: 'QUEUED',
      progress: 10,
      canResume: true,
      resumeCount: 0,
      maxResumeAttempts: 3,
      revision: state.outlineRevision,
    });
    persistAuthoring();
    return wait({ jobId, status: 'QUEUED' }, 80);
  },
  getOutlineDraft(courseId: string): Promise<OutlineDraftResponse> {
    const state = ensureAuthoringState(courseId);
    return wait({
      outline: JSON.parse(JSON.stringify(state.outline)) as CourseOutlineData,
      state: state.outlineState,
      revision: state.outlineRevision,
    });
  },
  saveOutlineDraft(courseId: string, outline: CourseOutlineData, expectedRevision: number): Promise<OutlineDraftResponse> {
    const state = ensureAuthoringState(courseId);
    if (state.outlineRevision !== expectedRevision) {
      return Promise.reject(new Error(`409: Xung đột phiên bản khung môn học (expected ${expectedRevision}, current ${state.outlineRevision}).`));
    }
    state.outline = JSON.parse(JSON.stringify(outline)) as CourseOutlineData;
    state.outlineRevision += 1;
    persistAuthoring();
    return wait({
      outline: JSON.parse(JSON.stringify(state.outline)) as CourseOutlineData,
      state: state.outlineState,
      revision: state.outlineRevision,
    });
  },
  approveOutline(courseId: string, expectedRevision: number): Promise<{ state: 'OUTLINE_APPROVED'; revision: number }> {
    const state = ensureAuthoringState(courseId);
    if (state.outlineRevision !== expectedRevision) {
      return Promise.reject(new Error('409: Phiên bản khung môn học đã thay đổi, vui lòng tải lại.'));
    }
    if (!state.outline.chapters.length || !state.outline.learningOutcomes.length) {
      return Promise.reject(new Error('422: Khung môn học phải có ít nhất 1 chương và 1 chuẩn đầu ra (LO).'));
    }
    state.outlineState = 'OUTLINE_APPROVED';
    state.outlineRevision += 1;
    persistAuthoring();
    return wait({ state: 'OUTLINE_APPROVED', revision: state.outlineRevision });
  },

  reopenChapter(courseId: string, chapterId: string, expectedRevision: number): Promise<{ draftId: string; state: 'DRAFT'; revision: number }> {
    const state = ensureAuthoringState(courseId);
    const ch = state.outline.chapters.find((c) => c.id === chapterId);
    if (!ch) return Promise.reject(new Error('Không tìm thấy chương.'));
    if (ch.revision !== expectedRevision) {
      return Promise.reject(new Error('409: Xung đột phiên bản chương.'));
    }
    ch.state = 'DRAFT';
    ch.revision += 1;
    persistAuthoring();
    return wait({ draftId: `draft-${chapterId}-${ch.revision}`, state: 'DRAFT', revision: ch.revision });
  },
  async uploadChapterDocument(courseId: string, chapterId: string, file: File): Promise<{ documentId: string; revision: number }> {
    const state = ensureAuthoringState(courseId);
    if (state.outlineState !== 'OUTLINE_APPROVED') {
      return Promise.reject(new Error('409 OUTLINE_NOT_APPROVED: Cần duyệt Khung môn học (D1) trước khi gắn tài liệu chương.'));
    }
    const ch = state.outline.chapters.find((c) => c.id === chapterId);
    if (!ch) return Promise.reject(new Error('Không tìm thấy chương.'));
    if (ch.state === 'PUBLISHED') {
      return Promise.reject(new Error('409 REOPEN_REQUIRED: Chương đã xuất bản, cần Mở lại (Reopen) trước khi tải tài liệu mới.'));
    }
    const uploaded = await this.uploadCourseFile(courseId, file);
    ch.documentCount = (ch.documentCount ?? 0) + 1;
    ch.revision += 1;
    persistAuthoring();
    return wait({ documentId: uploaded.id, revision: ch.revision }, 80);
  },
  createLessonJob(courseId: string, chapterId: string, expectedRevision: number, idempotencyKey: string): Promise<{ jobId: string; status: string }> {
    const state = ensureAuthoringState(courseId);
    if (state.outlineState !== 'OUTLINE_APPROVED') {
      return Promise.reject(new Error('409 OUTLINE_NOT_APPROVED: Khung môn học chưa được duyệt.'));
    }
    const ch = state.outline.chapters.find((c) => c.id === chapterId);
    if (!ch) return Promise.reject(new Error('Không tìm thấy chương.'));
    if (ch.revision !== expectedRevision) {
      return Promise.reject(new Error('409: Revision của chương đã lệch, vui lòng làm mới.'));
    }
    const jobId = `job-lesson-${courseId}-${chapterId}-${Date.now()}`;
    authoringJobs.set(jobId, {
      kind: 'lesson',
      courseId,
      chapterId,
      idempotencyKey,
      polls: 0,
      status: 'QUEUED',
      progress: 15,
      canResume: true,
      resumeCount: 0,
      maxResumeAttempts: 3,
      revision: ch.revision,
    });
    persistAuthoring();
    return wait({ jobId, status: 'QUEUED' }, 80);
  },
  getChapterLessons(
    courseId: string,
    chapterId: string,
    cursor?: string | null,
    limit = 20,
  ): Promise<{ items: ChapterLessonItem[]; nextCursor: string | null; revision: number }> {
    const state = ensureAuthoringState(courseId);
    const ch = state.outline.chapters.find((c) => c.id === chapterId);
    const list = state.lessonsByChapter[chapterId] ?? [];
    const offset = cursor ? Number(cursor) || 0 : 0;
    const slice = list.slice(offset, offset + limit);
    const nextCursor = offset + limit < list.length ? String(offset + limit) : null;
    return wait({ items: slice.map((item) => ({ ...item })), nextCursor, revision: ch?.revision ?? 1 }, 60);
  },
  reviewChapterLesson(
    courseId: string,
    chapterId: string,
    lessonId: string,
    input: { decision: ReviewDecision; changes?: Partial<ChapterLessonItem>; reviewNote?: string; expectedRevision: number },
  ): Promise<{ lesson: ChapterLessonItem; revision: number }> {
    const state = ensureAuthoringState(courseId);
    const ch = state.outline.chapters.find((c) => c.id === chapterId);
    if (!ch) return Promise.reject(new Error('Không tìm thấy chương.'));
    if (ch.revision !== input.expectedRevision) {
      return Promise.reject(new Error('409: Revision chương đã thay đổi.'));
    }
    const list = state.lessonsByChapter[chapterId] ?? [];
    const target = list.find((l) => l.id === lessonId);
    if (!target) return Promise.reject(new Error('Không tìm thấy bài học.'));
    if (!['APPROVE', 'EDIT', 'REJECT', 'PENDING'].includes(input.decision)) {
      return Promise.reject(new Error('422: Quyết định duyệt không hợp lệ.'));
    }
    target.decision = input.decision;
    if (input.reviewNote !== undefined) target.reviewNote = input.reviewNote;
    if (input.changes) {
      if (input.changes.title !== undefined) target.title = input.changes.title;
      if (input.changes.content !== undefined) target.content = input.changes.content;
    }
    ch.revision += 1;
    persistAuthoring();
    return wait({ lesson: { ...target }, revision: ch.revision }, 50);
  },
  batchReviewChapterLessons(
    courseId: string,
    chapterId: string,
    input: {
      items: Array<{ lessonId: string; decision: ReviewDecision; changes?: Partial<ChapterLessonItem>; reviewNote?: string }>;
      expectedRevision: number;
    },
  ): Promise<{ updatedCount: number; revision: number }> {
    const state = ensureAuthoringState(courseId);
    const ch = state.outline.chapters.find((c) => c.id === chapterId);
    if (!ch) return Promise.reject(new Error('Không tìm thấy chương.'));
    if (ch.revision !== input.expectedRevision) {
      return Promise.reject(new Error('409: Revision chương đã thay đổi.'));
    }
    const list = state.lessonsByChapter[chapterId] ?? [];
    let updatedCount = 0;
    for (const item of input.items) {
      const target = list.find((l) => l.id === item.lessonId);
      if (target) {
        target.decision = item.decision;
        if (item.reviewNote !== undefined) target.reviewNote = item.reviewNote;
        updatedCount += 1;
      }
    }
    ch.revision += 1;
    persistAuthoring();
    return wait({ updatedCount, revision: ch.revision }, 60);
  },
  approveChapterLessons(courseId: string, chapterId: string, expectedRevision: number): Promise<{ state: 'LESSON_APPROVED'; revision: number }> {
    const state = ensureAuthoringState(courseId);
    const ch = state.outline.chapters.find((c) => c.id === chapterId);
    if (!ch) return Promise.reject(new Error('Không tìm thấy chương.'));
    if (ch.revision !== expectedRevision) {
      return Promise.reject(new Error('409: Revision chương đã thay đổi.'));
    }
    const list = state.lessonsByChapter[chapterId] ?? [];
    if (!list.length || list.some((l) => l.decision === 'PENDING')) {
      return Promise.reject(new Error('422: Mọi bài học trong chương phải có quyết định (APPROVE / EDIT / REJECT) trước khi duyệt.'));
    }
    ch.state = 'LESSON_APPROVED';
    ch.revision += 1;
    persistAuthoring();
    return wait({ state: 'LESSON_APPROVED', revision: ch.revision });
  },
  discardChapterLessons(courseId: string, chapterId: string, expectedRevision: number): Promise<{ state: 'DRAFT'; revision: number }> {
    const state = ensureAuthoringState(courseId);
    const ch = state.outline.chapters.find((c) => c.id === chapterId);
    if (!ch) return Promise.reject(new Error('Không tìm thấy chương.'));
    if (ch.revision !== expectedRevision) {
      return Promise.reject(new Error('409: Revision chương đã thay đổi.'));
    }
    state.lessonsByChapter[chapterId] = [];
    ch.state = 'DRAFT';
    ch.revision += 1;
    persistAuthoring();
    return wait({ state: 'DRAFT', revision: ch.revision });
  },

  createRelationJob(
    courseId: string,
    chapterIds: string[],
    expectedRevision: number,
    idempotencyKey: string,
  ): Promise<{ jobId: string; status: string }> {
    const state = ensureAuthoringState(courseId);
    const uniqueIds = Array.from(new Set(chapterIds));
    if (uniqueIds.length < 2) {
      return Promise.reject(new Error('422 MIN_TWO_CHAPTERS_REQUIRED: Cần chọn ít nhất 2 chương đã duyệt để sinh quan hệ liên chương.'));
    }
    const unapproved = uniqueIds.filter((cid) => {
      const ch = state.outline.chapters.find((c) => c.id === cid);
      return !ch || (ch.state !== 'LESSON_APPROVED' && ch.state !== 'PUBLISHED');
    });
    if (unapproved.length) {
      return Promise.reject(new Error('409: Tất cả các chương được chọn phải ở trạng thái LESSON_APPROVED.'));
    }
    if (state.relationRevision !== expectedRevision) {
      return Promise.reject(new Error('409: Revision quan hệ đã thay đổi.'));
    }
    const jobId = `job-relation-${courseId}-${Date.now()}`;
    authoringJobs.set(jobId, {
      kind: 'relation',
      courseId,
      chapterIds: uniqueIds,
      idempotencyKey,
      polls: 0,
      status: 'QUEUED',
      progress: 20,
      canResume: true,
      resumeCount: 0,
      maxResumeAttempts: 3,
      revision: state.relationRevision,
    });
    persistAuthoring();
    return wait({ jobId, status: 'QUEUED' }, 80);
  },
  getCourseRelations(
    courseId: string,
    cursor?: string | null,
    limit = 20,
  ): Promise<{ items: CourseRelationItem[]; nextCursor: string | null; revision: number }> {
    const state = ensureAuthoringState(courseId);
    const offset = cursor ? Number(cursor) || 0 : 0;
    const slice = state.relations.slice(offset, offset + limit);
    const nextCursor = offset + limit < state.relations.length ? String(offset + limit) : null;
    return wait({ items: slice.map((r) => ({ ...r })), nextCursor, revision: state.relationRevision }, 60);
  },
  reviewCourseRelation(
    courseId: string,
    relationId: string,
    input: { decision: ReviewDecision; changes?: Partial<CourseRelationItem>; reviewNote?: string; expectedRevision: number },
  ): Promise<{ relation: CourseRelationItem; revision: number }> {
    const state = ensureAuthoringState(courseId);
    if (state.relationRevision !== input.expectedRevision) {
      return Promise.reject(new Error('409: Revision quan hệ đã thay đổi.'));
    }
    const target = state.relations.find((r) => r.id === relationId);
    if (!target) return Promise.reject(new Error('Không tìm thấy quan hệ.'));
    target.decision = input.decision;
    if (input.reviewNote !== undefined) target.reviewNote = input.reviewNote;
    if (input.changes?.relationType) target.relationType = input.changes.relationType;
    state.relationRevision += 1;
    persistAuthoring();
    return wait({ relation: { ...target }, revision: state.relationRevision }, 50);
  },
  batchReviewCourseRelations(
    courseId: string,
    input: {
      items: Array<{ relationId: string; decision: ReviewDecision; changes?: Partial<CourseRelationItem>; reviewNote?: string }>;
      expectedRevision: number;
    },
  ): Promise<{ updatedCount: number; revision: number }> {
    const state = ensureAuthoringState(courseId);
    if (state.relationRevision !== input.expectedRevision) {
      return Promise.reject(new Error('409: Revision quan hệ đã thay đổi.'));
    }
    let updatedCount = 0;
    for (const item of input.items) {
      const target = state.relations.find((r) => r.id === item.relationId);
      if (target) {
        target.decision = item.decision;
        if (item.reviewNote !== undefined) target.reviewNote = item.reviewNote;
        updatedCount += 1;
      }
    }
    state.relationRevision += 1;
    persistAuthoring();
    return wait({ updatedCount, revision: state.relationRevision }, 60);
  },
  discardCourseRelations(courseId: string, expectedRevision: number): Promise<{ revision: number }> {
    const state = ensureAuthoringState(courseId);
    if (state.relationRevision !== expectedRevision) {
      return Promise.reject(new Error('409: Revision quan hệ đã thay đổi.'));
    }
    state.relations = [];
    state.relationRevision += 1;
    persistAuthoring();
    return wait({ revision: state.relationRevision });
  },

  publishCourseGraph(
    courseId: string,
    expectedRevision: number,
    expectedMasterVersion: number,
    _idempotencyKey: string,
  ): Promise<PublishCourseResponse> {
    const state = ensureAuthoringState(courseId);
    if (state.relationRevision !== expectedRevision || state.masterVersion !== expectedMasterVersion) {
      return Promise.reject(new Error('409: Phiên bản đồ thị hoặc masterVersion đã thay đổi.'));
    }
    const approvedChapters = state.outline.chapters.filter((c) => c.state === 'LESSON_APPROVED' || c.state === 'PUBLISHED');
    if (state.outlineState !== 'OUTLINE_APPROVED' || approvedChapters.length === 0) {
      return Promise.reject(new Error('422: Cần duyệt khung môn học và ít nhất 1 chương trước khi xuất bản Master Graph.'));
    }
    if (state.relations.some((r) => r.decision === 'PENDING')) {
      return Promise.reject(new Error('422: Còn quan hệ liên chương chưa được duyệt (PENDING).'));
    }

    const course = teacherCoursesStore.find((c) => c.id === courseId);
    const nodes: KnowledgeGraphNode[] = [
      {
        id: courseId,
        name: course ? `${course.title} (${course.code})` : courseId,
        type: 'Course',
        description: `Master Graph v${state.masterVersion + 1}`,
        properties: { code: course?.code ?? courseId },
      },
    ];
    const edges: KnowledgeGraphEdge[] = [];

    for (const lo of state.outline.learningOutcomes) {
      const loId = `${courseId}.${lo.code.replace(/\./g, '')}`;
      nodes.push({ id: loId, name: `${lo.code}: ${lo.description}`, type: 'LO', properties: { code: lo.code, status: 'approved' } });
      edges.push({ source: loId, target: courseId, type: 'DEVELOP', properties: { status: 'approved' } });
    }

    for (const ch of approvedChapters) {
      ch.state = 'PUBLISHED';
      const lessons = (state.lessonsByChapter[ch.id] ?? []).filter((l) => l.decision !== 'REJECT');
      lessons.forEach((l, idx) => {
        nodes.push({
          id: l.id,
          name: l.title,
          type: 'Concept',
          description: l.content,
          properties: { chapter_id: ch.id, status: 'approved', sourceRef: l.sourceRef },
        });
        const loCode = l.loCodes[0] ?? state.outline.learningOutcomes[0]?.code;
        if (loCode) {
          const loId = `${courseId}.${loCode.replace(/\./g, '')}`;
          edges.push({ source: l.id, target: loId, type: 'DEVELOP', properties: { status: 'approved' } });
        }
        if (idx > 0) {
          edges.push({ source: lessons[idx - 1].id, target: l.id, type: 'PREREQUISITE', properties: { status: 'approved' } });
        }
      });
    }

    for (const rel of state.relations.filter((r) => r.decision !== 'REJECT')) {
      edges.push({
        source: rel.sourceId,
        target: rel.targetId,
        type: rel.relationType,
        properties: { status: 'approved', sourceRef: rel.sourceRef },
      });
    }

    knowledgeGraphStore.set(courseId, { nodes, edges });
    persistKnowledgeGraph();
    if (course) {
      course.totalNodes = nodes.length;
      course.nodesWithContent = nodes.length;
      course.published = true;
      course.pending = 0;
      persistTeacherCourses();
    }

    state.masterVersion += 1;
    state.relationRevision += 1;
    persistAuthoring();
    return wait({
      state: 'PUBLISHED',
      revision: state.relationRevision,
      masterVersion: state.masterVersion,
      warnings: [],
    });
  },
  recoverCoursePublish(courseId: string, _publicationId: string): Promise<PublishCourseResponse> {
    const state = ensureAuthoringState(courseId);
    return wait({
      state: 'PUBLISHED',
      revision: state.relationRevision,
      masterVersion: state.masterVersion,
      warnings: [],
    });
  },

  getWorkflowJob(jobId: string): Promise<WorkflowJobResponse> {
    const job = authoringJobs.get(jobId);
    if (!job) return Promise.reject(new Error('Không tìm thấy job.'));
    job.polls += 1;
    if (job.polls === 1) {
      job.status = 'RUNNING';
      job.progress = 55;
    } else if (job.status !== 'SUCCEEDED') {
      job.status = 'SUCCEEDED';
      job.progress = 100;
      const state = ensureAuthoringState(job.courseId);
      if (job.kind === 'outline') {
        const course = teacherCoursesStore.find((c) => c.id === job.courseId);
        const title = course?.title ?? job.courseId;
        state.outline = {
          learningOutcomes: [
            { code: 'L.O.1', description: `Nắm vững nền tảng lý thuyết của ${title}` },
            { code: 'L.O.2', description: `Phân tích và vận dụng mô hình trong ${title}` },
          ],
          chapters: [
            { id: 'ch1', title: 'Chương 1: Tổng quan & Kiến trúc cơ bản', loCodes: ['L.O.1'], state: 'DRAFT', revision: 1, documentCount: 0 },
            { id: 'ch2', title: 'Chương 2: Nguyên lý & Thuật toán cốt lõi', loCodes: ['L.O.1', 'L.O.2'], state: 'DRAFT', revision: 1, documentCount: 0 },
            { id: 'ch3', title: 'Chương 3: Ứng dụng & Đánh giá hệ thống', loCodes: ['L.O.2'], state: 'DRAFT', revision: 1, documentCount: 0 },
          ],
        };
        state.outlineState = 'OUTLINE_REVIEW';
        state.outlineRevision += 1;
        job.revision = state.outlineRevision;
      } else if (job.kind === 'lesson' && job.chapterId) {
        const ch = state.outline.chapters.find((c) => c.id === job.chapterId);
        const chTitle = ch?.title ?? job.chapterId;
        state.lessonsByChapter[job.chapterId] = [
          {
            id: `${job.courseId}_${job.chapterId}_l1`,
            title: `Khái niệm nhập môn - ${chTitle}`,
            content: `Định nghĩa cốt lõi, mô hình và ví dụ minh họa trích xuất từ tài liệu ${chTitle}.`,
            sourceRef: 'Slide tr. 3-8',
            loCodes: ch?.loCodes ?? ['L.O.1'],
            aiComment: 'AI đã kiểm tra lại: khớp 96% với tài liệu chương và L.O.1.',
            hasWarning: false,
            decision: 'PENDING',
          },
          {
            id: `${job.courseId}_${job.chapterId}_l2`,
            title: `Cơ chế hoạt động & Phân tích - ${chTitle}`,
            content: `Phân tích cơ chế vận hành, độ phức tạp và các trường hợp biên trong ${chTitle}.`,
            sourceRef: 'Slide tr. 9-16',
            loCodes: ch?.loCodes ?? ['L.O.1'],
            aiComment: 'AI nghi ngờ: Phần ví dụ thực nghiệm cần giảng viên rà soát thêm.',
            hasWarning: true,
            decision: 'PENDING',
          },
          {
            id: `${job.courseId}_${job.chapterId}_l3`,
            title: `Bài tập vận dụng - ${chTitle}`,
            content: `Tổng hợp câu hỏi ôn tập và tình huống áp dụng cho ${chTitle}.`,
            sourceRef: 'Slide tr. 17-22',
            loCodes: ch?.loCodes ?? ['L.O.2'],
            aiComment: 'AI đã đối chiếu chuẩn đầu ra: đạt yêu cầu.',
            hasWarning: false,
            decision: 'PENDING',
          },
        ];
        if (ch) {
          ch.state = 'LESSON_REVIEW';
          ch.revision += 1;
          job.revision = ch.revision;
        }
      } else if (job.kind === 'relation' && job.chapterIds) {
        const chIds = job.chapterIds;
        const relations: CourseRelationItem[] = [];
        for (let i = 0; i < chIds.length - 1; i += 1) {
          const srcLessons = (state.lessonsByChapter[chIds[i]] ?? []).filter((l) => l.decision !== 'REJECT');
          const tgtLessons = (state.lessonsByChapter[chIds[i + 1]] ?? []).filter((l) => l.decision !== 'REJECT');
          if (srcLessons.length && tgtLessons.length) {
            relations.push({
              id: `rel-${chIds[i]}-${chIds[i + 1]}-1`,
              sourceId: srcLessons[srcLessons.length - 1].id,
              sourceName: srcLessons[srcLessons.length - 1].title,
              sourceChapterId: chIds[i],
              targetId: tgtLessons[0].id,
              targetName: tgtLessons[0].title,
              targetChapterId: chIds[i + 1],
              relationType: 'PREREQUISITE',
              sourceRef: `Liên kết ${chIds[i]} → ${chIds[i + 1]}`,
              aiComment: 'AI đề xuất tiên quyết liên chương dựa trên khái niệm nền tảng.',
              hasWarning: false,
              decision: 'PENDING',
            });
          }
        }
        state.relations = relations;
        state.relationRevision += 1;
        job.revision = state.relationRevision;
      }
      persistAuthoring();
    }
    return wait({
      jobId,
      status: job.status,
      progress: job.progress,
      result: job.status === 'SUCCEEDED' ? { revision: job.revision } : undefined,
      canResume: job.canResume,
      resumeCount: job.resumeCount,
      maxResumeAttempts: job.maxResumeAttempts,
    }, 150);
  },
  resumeWorkflowJob(jobId: string, _idempotencyKey: string): Promise<{ jobId: string; status: 'QUEUED' }> {
    const job = authoringJobs.get(jobId);
    if (!job) return Promise.reject(new Error('Không tìm thấy job.'));
    if (job.resumeCount >= job.maxResumeAttempts) {
      return Promise.reject(new Error('409: Đã vượt quá số lần resume tối đa (3 lần).'));
    }
    job.resumeCount += 1;
    job.status = 'QUEUED';
    job.polls = 0;
    return wait({ jobId, status: 'QUEUED' }, 80);
  },
};

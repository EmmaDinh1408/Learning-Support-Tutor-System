import type {
  ClusterView, HeatSpot, LearningOutcome, NodeDetail, NodeEditorData, PdfFile, QueueSummary,
  Role, StudentCourse, StudentGraph, TeacherCourse, TeacherGraphData, User,
} from '../types';
import * as m from './mockData';

/**
 * Lớp API. Hiện tại trả dữ liệu mẫu; khi có backend chỉ cần thay phần thân
 * mỗi hàm bằng `fetch(`${BASE_URL}/...`)`.
 */
export const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

const wait = <T,>(data: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

export const api = {
  login(identity: string, _password: string, role: Role): Promise<User> {
    const isTeacher = role === 'teacher';
    return wait({
      name: isTeacher ? 'Nguyễn Văn Hùng' : 'Nguyễn Anh',
      initials: isTeacher ? 'NH' : 'NA',
      email: identity || (isTeacher ? 'giangvien@hcmut.edu.vn' : 'sinhvien@hcmut.edu.vn'),
      role,
    });
  },
  getStudentCourses: (): Promise<StudentCourse[]> => wait(m.studentCourses),
  getTeacherCourses: (): Promise<TeacherCourse[]> => wait(m.teacherCourses),
  createTeacherCourse(data: Omit<TeacherCourse, 'students' | 'pending' | 'published' | 'nodesWithContent' | 'totalNodes'>): Promise<TeacherCourse> {
    const course: TeacherCourse = { ...data, students: 0, published: false, nodesWithContent: 0, totalNodes: 0 };
    m.teacherCourses.unshift(course);
    m.studentCourses.unshift({
      id: course.id,
      code: course.code,
      title: course.title,
      faculty: course.faculty,
      lecturer: 'Nguyễn Văn Hùng',
      progress: 0,
      gap: 'Chưa có dữ liệu học tập',
      deadline: '',
      theme: course.theme,
    });
    return wait(course);
  },
  getLearningOutcomes: (): Promise<LearningOutcome[]> => wait(m.learningOutcomes),
  getStudentGraph: (courseId: string, clusterId?: string): Promise<StudentGraph> =>
    wait(courseId === 'CO3093'
      ? m.computerNetworksOverview
      : clusterId === 'pointer' ? m.studentPointerCluster : m.studentOverview),
  getNodeDetail: (nodeId: string): Promise<NodeDetail> => wait(m.buildNodeDetail(nodeId), 60),
  getTeacherGraph: (courseId: string): Promise<TeacherGraphData> =>
    wait(courseId === 'CO3093' ? m.computerNetworksTeacherGraph : m.teacherGraph),
  getClusterView: (clusterId: string): Promise<ClusterView> => wait(m.buildClusterView(clusterId)),
  getReviewQueue: (_courseId: string): Promise<QueueSummary> => wait(m.reviewQueue),
  getHeatSpot: (clusterId?: string): Promise<HeatSpot> => wait(m.heatSpots[clusterId ?? ''] ?? m.heatSpots.pointer, 60),
  getCoursePdfs: (_courseId: string): Promise<PdfFile[]> => wait(m.pdfFiles),
  getLoChains: () => wait(m.loChains),
  getNodeEditor: (nodeId: string): Promise<NodeEditorData> => wait(m.buildNodeEditor(nodeId)),
};

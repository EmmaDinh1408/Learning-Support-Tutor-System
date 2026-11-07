export type Role = 'student' | 'teacher';

export interface User {
  name: string;
  initials: string;
  email: string;
  role: Role;
}

export type CourseTheme = 'blue' | 'green' | 'orange' | 'slate';

export interface StudentCourse {
  id: string;
  code: string;
  title: string;
  faculty: string;
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
  faculty: string;
  students: number;
  pending?: number;
  published: boolean;
  nodesWithContent: number;
  totalNodes: number;
  theme: CourseTheme;
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
  status: 'Đã duyệt' | 'Bản nháp' | 'Chờ duyệt' | 'Ngoài cụm';
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

export interface PdfFile {
  id: string;
  name: string;
  pages: number;
  sizeMb: number;
  date: string;
}

export interface ContentItem {
  id: string;
  kind: 'Definition' | 'Example';
  status: 'Đã duyệt' | 'Bản nháp';
  title: string;
  source: string;
}

export interface QuestionItem {
  id: string;
  text: string;
  bloom: string;
  difficulty: string;
  status: 'Đã duyệt' | 'Bản nháp';
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

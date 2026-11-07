import type {
  ClusterView, HeatSpot, LearningOutcome, NodeDetail, NodeEditorData, PdfFile,
  QueueSummary, StudentCourse, StudentGraph, TeacherCourse, TeacherGraphData, TeacherNode,
} from '../types';

export const studentCourses: StudentCourse[] = [
  {
    id: 'CO2003', code: 'CO2003', title: 'Cấu trúc dữ liệu và giải thuật (CO2003)',
    faculty: 'Khoa Khoa học Ứng dụng', lecturer: 'Nguyễn Văn Hùng', progress: 10,
    gap: 'Lỗ hổng: Giới hạn · 42', deadline: 'Hạn 12/10 · Bài tập Tuần 3', theme: 'blue',
  },
  {
    id: 'MT2013', code: 'MT2013', title: 'Xác suất thống kê (MT2013)',
    faculty: 'Khoa Khoa học Ứng dụng', lecturer: 'Nguyễn Văn Hùng', progress: 25,
    gap: 'Lỗ hổng: Xác suất có điều kiện · 51', deadline: '', theme: 'green',
  },
];

export const teacherCourses: TeacherCourse[] = [
  { id: 'CO2003', code: 'CO2003', title: 'Cấu trúc dữ liệu và giải thuật (CO2003)', faculty: 'Khoa Khoa học Ứng dụng', students: 42, pending: 6, published: true, nodesWithContent: 71, totalNodes: 82, theme: 'blue' },
  { id: 'CO2003-L03', code: 'CO2003-L03', title: 'Cấu trúc dữ liệu và giải thuật – Lớp mới (CO2003-L03)', faculty: 'Khoa Khoa học Ứng dụng', students: 0, published: false, nodesWithContent: 0, totalNodes: 0, theme: 'orange' },
  { id: 'CO1007', code: 'CO1007', title: 'Toán rời rạc (CO1007)', faculty: 'Khoa Khoa học Ứng dụng', students: 64, published: true, nodesWithContent: 30, totalNodes: 30, theme: 'slate' },
  { id: 'MT2013', code: 'MT2013', title: 'Xác suất thống kê (MT2013)', faculty: 'Khoa Khoa học Ứng dụng', students: 38, published: true, nodesWithContent: 20, totalNodes: 40, theme: 'green' },
];

export const learningOutcomes: LearningOutcome[] = [
  { id: 'LO1', title: 'Phân tích độ phức tạp thuật toán', done: 0, total: 8, percent: 0 },
  { id: 'LO2', title: 'Hiện thực cấu trúc dữ liệu tuyến tính', done: 6, total: 25, percent: 24 },
  { id: 'LO3', title: 'Hiện thực cây và bảng băm', done: 0, total: 18, percent: 0 },
  { id: 'LO4', title: 'Áp dụng thuật toán sắp xếp, tìm kiếm, đồ thị', done: 0, total: 19, percent: 0 },
];

/* ---------------------------- Học viên ---------------------------- */

export const studentOverview: StudentGraph = {
  nodes: [
    { id: 'complexity', label: 'Độ phức tạp', sub: '0/7 node', x: 0, y: 70, status: 'locked', lo: 'LO1', drillable: true },
    { id: 'pointer', label: 'Con trỏ', sub: '6/9 node', x: 0, y: 200, status: 'progress', mastery: 67, lo: 'LO2', drillable: true },
    { id: 'dll', label: 'Danh sách liên kết', sub: '5/12 node', x: 170, y: 140, status: 'progress', mastery: 43, lo: 'LO2', drillable: true },
    { id: 'queue', label: 'Queue', sub: '0/6 node', x: 340, y: 20, status: 'locked', lo: 'LO3', drillable: true },
    { id: 'stack', label: 'Stack', sub: '0/8 node', x: 340, y: 140, status: 'locked', lo: 'LO2', drillable: true },
    { id: 'hash', label: 'Bảng băm', sub: '0/10 node', x: 340, y: 260, status: 'locked', lo: 'LO3', drillable: true },
    { id: 'tree', label: 'Cây', sub: '0/14 node', x: 510, y: 140, status: 'locked', lo: 'LO3', drillable: true },
    { id: 'heap', label: 'Heap', sub: '0/7 node', x: 670, y: 140, status: 'locked', lo: 'LO3', drillable: true },
    { id: 'sort', label: 'Sắp xếp', sub: '0/9 node', x: 830, y: 80, status: 'locked', lo: 'LO4', drillable: true },
    { id: 'graph', label: 'Đồ thị', sub: '0/10 node', x: 830, y: 220, status: 'locked', lo: 'LO4', drillable: true },
  ],
  edges: [
    { from: 'complexity', to: 'dll', kind: 'prereq' },
    { from: 'pointer', to: 'dll', kind: 'prereq' },
    { from: 'dll', to: 'queue', kind: 'prereq' },
    { from: 'dll', to: 'stack', kind: 'prereq' },
    { from: 'dll', to: 'hash', kind: 'prereq' },
    { from: 'queue', to: 'tree', kind: 'prereq' },
    { from: 'stack', to: 'tree', kind: 'prereq' },
    { from: 'hash', to: 'tree', kind: 'related' },
    { from: 'tree', to: 'heap', kind: 'prereq' },
    { from: 'heap', to: 'sort', kind: 'prereq' },
    { from: 'heap', to: 'graph', kind: 'prereq' },
    { from: 'complexity', to: 'sort', kind: 'concept' },
  ],
};

export const studentPointerCluster: StudentGraph = {
  nodes: [
    { id: 'ptr_decl', label: 'Khai báo và truy xuất', sub: '10 tài liệu', x: 0, y: 230, status: 'mastered', mastery: 100, lo: 'LO2' },
    { id: 'ptr_null', label: 'Con trỏ null', sub: '4 tài liệu', x: 190, y: 120, status: 'locked', mastery: 0, lo: 'LO2' },
    { id: 'ptr_ptr', label: 'Con trỏ kết con trỏ', sub: '5 tài liệu', x: 190, y: 230, status: 'mastered', mastery: 100, lo: 'LO2' },
    { id: 'ptr_alloc', label: 'Cấp phát động', sub: '8 tài liệu', x: 190, y: 340, status: 'review', mastery: 42, lo: 'LO2' },
    { id: 'ptr_leak', label: 'Rò rỉ bộ nhớ và con trỏ treo', sub: '6 tài liệu', x: 400, y: 280, status: 'locked', mastery: 0, lo: 'LO2' },
    { id: 'ptr_node', label: 'Node và liên kết', sub: 'Danh sách liên kết', x: 590, y: 110, status: 'mastered', mastery: 100, lo: 'LO2', tag: 'Sang cụm khác' },
    { id: 'ptr_insert', label: 'Chèn node', sub: 'Danh sách liên kết', x: 590, y: 230, status: 'available', mastery: 0, lo: 'LO2', tag: 'Sang cụm khác' },
    { id: 'ptr_arr', label: 'Cấp bảng ánh xạ', sub: 'Stack bằng mảng', x: 590, y: 340, status: 'locked', mastery: 0, lo: 'LO2', tag: 'Sang cụm khác' },
  ],
  edges: [
    { from: 'ptr_decl', to: 'ptr_null', kind: 'related' },
    { from: 'ptr_decl', to: 'ptr_ptr', kind: 'prereq' },
    { from: 'ptr_decl', to: 'ptr_alloc', kind: 'prereq' },
    { from: 'ptr_ptr', to: 'ptr_node', kind: 'prereq' },
    { from: 'ptr_ptr', to: 'ptr_insert', kind: 'related' },
    { from: 'ptr_alloc', to: 'ptr_leak', kind: 'prereq' },
    { from: 'ptr_alloc', to: 'ptr_insert', kind: 'prereq' },
    { from: 'ptr_leak', to: 'ptr_arr', kind: 'prereq' },
    { from: 'ptr_null', to: 'ptr_node', kind: 'related' },
  ],
};

export function buildNodeDetail(id: string): NodeDetail {
  const all = [...studentOverview.nodes, ...studentPointerCluster.nodes];
  const n = all.find((x) => x.id === id) ?? all[0];
  const base = {
    id: n.id, title: n.label, course: 'CO2003', cluster: 'Con trỏ',
    mastery: n.mastery ?? 0, lo: n.lo ?? 'LO2', status: n.status,
  };
  if (n.status === 'mastered') {
    return { ...base, statusLabel: 'Đã vững', prerequisites: [], cta: 'Ôn lại' };
  }
  if (n.status === 'review') {
    return {
      ...base, statusLabel: 'Cần ôn',
      prerequisites: [{ title: 'Khai báo và truy xuất', state: 'Đã vững', done: true }],
      aiHint: 'Bạn sai câu về chèn node 2 lần. Ôn Cấp phát động sẽ giúp củng cố bước tạo node mới.',
      cta: 'Ôn ngay',
    };
  }
  if (n.status === 'locked') {
    return {
      ...base, statusLabel: 'Đang khoá',
      prerequisites: [{ title: 'Cấp phát động', state: 'Chưa đạt', done: false }],
      cta: 'Xem điều kiện',
    };
  }
  return {
    ...base, statusLabel: n.status === 'progress' ? 'Đang học' : 'Sẵn sàng',
    prerequisites: [{ title: 'Cấp phát động', state: 'Đã vững', done: true }],
    cta: 'Học ngay',
  };
}

/* ---------------------------- Giảng viên ---------------------------- */

export const teacherGraph: TeacherGraphData = {
  stats: { nodes: 82, edges: 107, drafts: 6 },
  clusters: [
    { id: 'complexity', index: 1, name: 'Độ phức tạp', nodeCount: 7, x: 0, y: 70, lo: ['LO1'], struggle: 12, approved: true },
    { id: 'pointer', index: 2, name: 'Con trỏ', nodeCount: 9, x: 0, y: 210, lo: ['LO2'], issue: { label: 'Chưa gán LO', level: 'error' }, struggle: 38, approved: true },
    { id: 'dll', index: 3, name: 'Danh sách liên kết', nodeCount: 12, x: 165, y: 140, lo: ['LO2'], issue: { label: '2 cần xử lý', level: 'warn' }, struggle: 22, approved: false },
    { id: 'queue', index: 4, name: 'Queue', nodeCount: 6, x: 330, y: 0, lo: ['LO2'], struggle: 9, approved: false },
    { id: 'stack', index: 5, name: 'Stack', nodeCount: 8, x: 330, y: 130, lo: ['LO2'], issue: { label: '1 chờ duyệt', level: 'warn' }, struggle: 25, approved: false },
    { id: 'hash', index: 6, name: 'Bảng băm', nodeCount: 10, x: 330, y: 270, lo: ['LO3'], issue: { label: '1 chu trình', level: 'error' }, struggle: 31, approved: false },
    { id: 'tree', index: 7, name: 'Cây', nodeCount: 14, x: 495, y: 150, lo: ['LO3'], struggle: 10, approved: false },
    { id: 'heap', index: 8, name: 'Heap', nodeCount: 7, x: 660, y: 140, lo: ['LO3'], struggle: 6, approved: false },
    { id: 'sort', index: 9, name: 'Sắp xếp', nodeCount: 9, x: 825, y: 70, lo: ['LO4'], struggle: 4, approved: false },
    { id: 'graph', index: 10, name: 'Đồ thị', nodeCount: 10, x: 825, y: 230, lo: ['LO4'], struggle: 8, approved: false },
    { id: 'search', index: 11, name: 'Tìm kiếm', nodeCount: 5, x: 990, y: 150, lo: ['LO4'], struggle: 3, approved: false },
  ],
  clusterEdges: [
    { from: 'complexity', to: 'dll', kind: 'prereq' },
    { from: 'pointer', to: 'dll', kind: 'prereq' },
    { from: 'dll', to: 'queue', kind: 'prereq' },
    { from: 'dll', to: 'stack', kind: 'prereq' },
    { from: 'dll', to: 'hash', kind: 'prereq' },
    { from: 'queue', to: 'tree', kind: 'prereq' },
    { from: 'stack', to: 'tree', kind: 'prereq' },
    { from: 'hash', to: 'tree', kind: 'related' },
    { from: 'tree', to: 'heap', kind: 'prereq' },
    { from: 'heap', to: 'sort', kind: 'prereq' },
    { from: 'heap', to: 'graph', kind: 'prereq' },
    { from: 'sort', to: 'search', kind: 'prereq' },
    { from: 'graph', to: 'search', kind: 'prereq' },
    { from: 'complexity', to: 'sort', kind: 'prereq' },
    { from: 'complexity', to: 'queue', kind: 'concept' },
    { from: 'pointer', to: 'stack', kind: 'concept' },
  ],
};

export const reviewQueue: QueueSummary = {
  total: 13, pending: 6, missingTest: 3, cycleWarn: 1, noLo: 3,
  items: [
    { id: 'q1', title: 'Chu trình trong Bảng băm', cluster: 'Bảng băm', tag: 'Chu trình', severity: 'error' },
    { id: 'q2', title: 'Con trỏ hàm', cluster: 'Con trỏ', tag: 'Chưa gán LO', severity: 'warn' },
    { id: 'q3', title: 'Ứng dụng bảng băm', cluster: 'Bảng băm', tag: 'Chưa gán LO', severity: 'warn' },
    { id: 'q4', title: 'Cây khung nhỏ nhất', cluster: 'Đồ thị', tag: 'Chưa gán LO', severity: 'warn' },
    { id: 'q5', title: 'Push', cluster: 'Stack', tag: 'Bản AI', severity: 'ai' },
    { id: 'q6', title: 'Stack bằng linked list', cluster: 'Stack', tag: 'Bản AI', severity: 'ai' },
    { id: 'q7', title: 'Danh sách vòng', cluster: 'Danh sách liên kết', tag: 'Bản AI', severity: 'ai' },
    { id: 'q8', title: 'Ứng dụng Stack', cluster: 'Stack', tag: 'Chờ duyệt', severity: 'info' },
  ],
};

function makeClusterView(clusterName: string): ClusterView {
  const nodes: TeacherNode[] = [
    { id: 'g1', name: 'Node và liên kết', status: 'Ngoài cụm', ghost: true, ghostFrom: 'Danh sách liên kết', x: 0, y: 0 },
    { id: 'g2', name: 'Ứng dụng Stack', status: 'Ngoài cụm', ghost: true, ghostFrom: 'Stack', x: 0, y: 120 },
    { id: 'g3', name: 'Enqueue', status: 'Ngoài cụm', ghost: true, ghostFrom: 'Queue', x: 0, y: 240 },
    { id: 'n1', name: `Khái niệm ${clusterName.toLowerCase()}`, status: 'Đã duyệt', x: 230, y: 110, lo: ['LO3'], incoming: 1, outgoing: 3, contents: 4, questions: 4 },
    { id: 'n2', name: 'Duyệt theo mức', status: 'Đã duyệt', x: 230, y: 250, lo: ['LO3'], incoming: 1, outgoing: 1, contents: 3, questions: 3 },
    { id: 'n3', name: `${clusterName} nhị phân`, status: 'Đã duyệt', x: 450, y: 170, lo: ['LO3'], incoming: 1, outgoing: 3, contents: 5, questions: 4 },
    { id: 'n4', name: 'Duyệt cây (NLR, LNR, LRN)', status: 'Đã duyệt', x: 670, y: 270, lo: ['LO3'], incoming: 2, outgoing: 0, contents: 6, questions: 5 },
    { id: 'n5', name: 'Cây nhị phân tìm kiếm', status: 'Bản nháp', x: 670, y: 90, lo: ['LO3'], incoming: 1, outgoing: 0, contents: 2, questions: 2 },
  ];
  return {
    nodes,
    edges: [
      { from: 'g1', to: 'n1', kind: 'prereq' },
      { from: 'g2', to: 'n1', kind: 'related' },
      { from: 'g3', to: 'n2', kind: 'related' },
      { from: 'n1', to: 'n3', kind: 'prereq' },
      { from: 'n1', to: 'n2', kind: 'prereq' },
      { from: 'n2', to: 'n3', kind: 'related' },
      { from: 'n3', to: 'n4', kind: 'prereq' },
      { from: 'n3', to: 'n5', kind: 'prereq' },
    ],
  };
}

export function buildClusterView(clusterId: string): ClusterView {
  const c = teacherGraph.clusters.find((x) => x.id === clusterId);
  return makeClusterView(c?.name ?? 'Cây');
}

export const heatSpots: Record<string, HeatSpot> = {
  pointer: {
    cluster: 'Con trỏ', node: 'Cấp phát động', struggling: 16, total: 42,
    students: [
      { initials: 'NH', name: 'Trần Ngọc Hà', meta: '2310137 · Nhóm L01', percent: 23 },
      { initials: 'TB', name: 'Phạm Thị Bình', meta: '2310411 · Nhóm A01', percent: 18 },
      { initials: 'LC', name: 'Lê Văn Cường', meta: '2310522 · Nhóm L02', percent: 15 },
    ],
  },
  hash: {
    cluster: 'Bảng băm', node: 'Xử lý đụng độ', struggling: 13, total: 42,
    students: [
      { initials: 'VM', name: 'Vũ Minh Quân', meta: '2310208 · Nhóm L01', percent: 21 },
      { initials: 'DL', name: 'Đỗ Thị Lan', meta: '2310310 · Nhóm A02', percent: 17 },
    ],
  },
};

export const pdfFiles: PdfFile[] = [
  { id: 'f1', name: 'Cau_truc_du_lieu_va_giai_thuat_Giao_trinh.pdf', pages: 120, sizeMb: 4.2, date: '12/09' },
  { id: 'f2', name: 'Cau_truc_du_lieu_va_giai_thuat_Chuong_1.pdf', pages: 36, sizeMb: 1.3, date: '12/09' },
  { id: 'f3', name: 'Cau_truc_du_lieu_va_giai_thuat_Chuong_2.pdf', pages: 28, sizeMb: 1.1, date: '12/09' },
  { id: 'f4', name: 'Cau_truc_du_lieu_va_giai_thuat_Chuong_3.pdf', pages: 31, sizeMb: 1.4, date: '12/09' },
];

export const loChains = [
  { lo: 'LO1', title: 'Phân tích độ phức tạp thuật toán', steps: ['Big-O', 'Các cấp độ', 'Phân tích vòng lặp'], end: 'Độ phức tạp', rel: 'Đóng góp LO' },
  { lo: 'LO2', title: 'Hiện thực cấu trúc dữ liệu tuyến tính', steps: ['Con trỏ', 'Danh sách liên kết', 'Stack', 'Queue'], end: 'Danh sách', rel: 'Tiên quyết bài tập' },
  { lo: 'LO3', title: 'Hiện thực cây và bảng băm', steps: ['Cây', 'Cây nhị phân', 'Heap'], end: 'Cây & băm', rel: 'Đóng góp LO' },
  { lo: 'LO4', title: 'Áp dụng thuật toán sắp xếp, tìm kiếm, đồ thị', steps: ['Sắp xếp', 'Tìm kiếm', 'Đồ thị'], end: 'Thuật toán', rel: 'DEVELOP' },
];

export function buildNodeEditor(nodeId: string): NodeEditorData {
  const name = nodeId === 'insert' ? 'Chèn node' : 'Chèn node';
  return {
    id: nodeId, name, course: 'CO2003', group: 'Stack', parentNode: 'Stack bằng mảng',
    cluster: 'Danh sách liên kết',
    description: 'Thêm một node mới vào danh sách liên kết bằng cách tạo node, cập nhật liên kết và bảo toàn cấu trúc của danh sách.',
    prerequisites: ['Con trỏ và truy xuất', 'Cấp phát động', 'Node và liên kết'],
    contents: [
      { id: 'c1', kind: 'Definition', status: 'Đã duyệt', title: 'Định nghĩa thao tác chèn node', source: 'Giáo trình CTDL&GT · Trang 54' },
      { id: 'c2', kind: 'Example', status: 'Đã duyệt', title: 'Chèn node vào đầu danh sách đơn', source: 'Giáo trình CTDL&GT · Trang 55' },
      { id: 'c3', kind: 'Example', status: 'Bản nháp', title: 'Chèn node sau một node đã biết', source: 'Giáo trình CTDL&GT · Trang 57' },
      { id: 'c4', kind: 'Definition', status: 'Bản nháp', title: 'Độ phức tạp của thao tác chèn', source: 'Giáo trình CTDL&GT · Trang 58' },
    ],
    questions: [
      { id: 'q1', text: 'Khi chèn node vào đầu danh sách đơn, con trỏ head được cập nhật như thế nào?', bloom: 'Nhớ', difficulty: 'Dễ', status: 'Đã duyệt' },
      { id: 'q2', text: 'Vì sao cần gán liên kết của node mới trước khi thay đổi head?', bloom: 'Hiểu', difficulty: 'Vừa', status: 'Đã duyệt' },
      { id: 'q3', text: 'Hoàn thiện đoạn mã chèn node sau một node đã biết.', bloom: 'Áp dụng', difficulty: 'Vừa', status: 'Bản nháp' },
      { id: 'q4', text: 'Phân tích tại sao chèn vào cuối danh sách đơn cần O(n) nếu không có con trỏ tail.', bloom: 'Phân tích', difficulty: 'Khó', status: 'Bản nháp' },
    ],
  };
}

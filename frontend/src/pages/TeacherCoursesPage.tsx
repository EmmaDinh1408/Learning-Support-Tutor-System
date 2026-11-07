import { useState } from 'react';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { CourseToolbar } from '../features/courses/CourseToolbar';
import { CourseCardShell } from '../features/courses/CourseCardShell';
import { ProgressBar } from '../features/common/ProgressBar';
import { useAsync } from '../features/common/useAsync';

export default function TeacherCoursesPage() {
  const { data } = useAsync(() => api.getTeacherCourses(), []);
  const [q, setQ] = useState('');
  const list = (data ?? []).filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <AppHeader />
      <main className="container">
        <h1 className="page-title">Các khoá học của tôi</h1>
        <CourseToolbar teacher statusOptions={['Tất cả (trừ đã ẩn)', 'Đã xuất bản', 'Chưa xuất bản']} query={q} onQuery={setQ} onCreate={() => alert('Tạo khóa học mới')} />
        <div className="course-grid">
          {list.map((c) => (
            <CourseCardShell key={c.id} code={c.code} theme={c.theme} faculty={c.faculty} title={c.title} to={`/teacher/courses/${c.id}/graph`}
              footer={<span className="node-count">{c.nodesWithContent}/{c.totalNodes} node có nội dung</span>}>
              <div className="course-meta">
                {c.students} học viên
                {c.pending ? <b className="pending">{c.pending} chờ duyệt</b> : null}
                {!c.published && <span className="unpub">Chưa xuất bản</span>}
              </div>
              <ProgressBar value={c.totalNodes ? (c.nodesWithContent / c.totalNodes) * 100 : 0} />
            </CourseCardShell>
          ))}
        </div>
      </main>
    </div>
  );
}

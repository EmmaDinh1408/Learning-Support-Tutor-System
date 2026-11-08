import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { CourseToolbar } from '../features/courses/CourseToolbar';
import { CourseCardShell } from '../features/courses/CourseCardShell';
import { ProgressBar } from '../features/common/ProgressBar';
import { useAsync } from '../features/common/useAsync';
import { useLanguage } from '../features/i18n/LanguageContext';

export default function TeacherCoursesPage() {
  const { language, t } = useLanguage();
  const { data } = useAsync(() => api.getTeacherCourses(), []);
  const [q, setQ] = useState('');
  const [courses, setCourses] = useState(data ?? []);
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [faculty, setFaculty] = useState('Khoa Khoa học Máy tính');

  useEffect(() => { if (data) setCourses(data); }, [data]);

  const createCourse = async () => {
    if (!code.trim() || !title.trim()) return;
    const course = await api.createTeacherCourse({
      id: code.trim().toUpperCase(),
      code: code.trim().toUpperCase(),
      title: `${title.trim()} (${code.trim().toUpperCase()})`,
      faculty,
      theme: 'orange',
    });
    setCourses((current) => [course, ...current]);
    setCreateOpen(false);
    setCode('');
    setTitle('');
  };

  const list = courses.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <AppHeader />
      <main className="container">
        <h1 className="page-title">{t('courses')}</h1>
        <CourseToolbar teacher statusOptions={language === 'en' ? ['All (except hidden)', 'Published', 'Unpublished'] : ['Tất cả (trừ đã ẩn)', 'Đã xuất bản', 'Chưa xuất bản']} query={q} onQuery={setQ} onCreate={() => setCreateOpen(true)} />
        <div className="course-grid">
          {list.map((c) => (
            <CourseCardShell key={c.id} code={c.code} theme={c.theme} faculty={c.faculty} title={c.title} to={`/teacher/courses/${c.id}/graph`}
              footer={<span className="node-count">{c.nodesWithContent}/{c.totalNodes} {language === 'en' ? 'nodes with content' : 'node có nội dung'}</span>}>
              <div className="course-meta">
                {c.students} {language === 'en' ? 'students' : 'học viên'}
                {c.pending ? <b className="pending">{c.pending} {language === 'en' ? 'pending' : 'chờ duyệt'}</b> : null}
                {!c.published && <span className="unpub">{t('draft')}</span>}
              </div>
              <ProgressBar value={c.totalNodes ? (c.nodesWithContent / c.totalNodes) * 100 : 0} />
            </CourseCardShell>
          ))}
        </div>
      </main>
      {createOpen && (
        <div className="course-modal-backdrop" role="presentation" onMouseDown={() => setCreateOpen(false)}>
          <div className="course-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <h2>{language === 'en' ? 'Create course' : 'Tạo khóa học mới'}</h2>
            <label>Mã khóa học<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: CO3094" /></label>
            <label>Tên khóa học<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: An ninh mạng" /></label>
            <label>Khoa<select value={faculty} onChange={(e) => setFaculty(e.target.value)}><option>Khoa Khoa học Máy tính</option><option>Khoa Khoa học Ứng dụng</option></select></label>
            <div className="course-modal-actions">
              <button className="btn btn-outline" onClick={() => setCreateOpen(false)}>Hủy</button>
              <button className="btn btn-primary" disabled={!code.trim() || !title.trim()} onClick={createCourse}>Tạo khóa học</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

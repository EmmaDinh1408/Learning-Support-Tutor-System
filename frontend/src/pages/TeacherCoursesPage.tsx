import { useState } from 'react';
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
  const list = (data ?? []).filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <AppHeader />
      <main className="container">
        <h1 className="page-title">{t('courses')}</h1>
        <CourseToolbar teacher statusOptions={language === 'en' ? ['All (except hidden)', 'Published', 'Unpublished'] : ['Tất cả (trừ đã ẩn)', 'Đã xuất bản', 'Chưa xuất bản']} query={q} onQuery={setQ} onCreate={() => alert(language === 'en' ? 'Create new course' : 'Tạo khóa học mới')} />
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
    </div>
  );
}

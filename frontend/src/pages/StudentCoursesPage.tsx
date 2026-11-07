import { useState } from 'react';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { CourseToolbar } from '../features/courses/CourseToolbar';
import { CourseCardShell } from '../features/courses/CourseCardShell';
import { ProgressBar } from '../features/common/ProgressBar';
import { useAsync } from '../features/common/useAsync';
import { useLanguage } from '../features/i18n/LanguageContext';

export default function StudentCoursesPage() {
  const { language, t } = useLanguage();
  const { data } = useAsync(() => api.getStudentCourses(), []);
  const [q, setQ] = useState('');
  const list = (data ?? []).filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <AppHeader />
      <main className="container">
        <h1 className="page-title">{t('courses')}</h1>
        <CourseToolbar statusOptions={language === 'en' ? ['In progress', 'Ended', 'All'] : ['Đang diễn ra', 'Đã kết thúc', 'Tất cả']} query={q} onQuery={setQ} />
        <div className="course-grid">
          {list.map((c) => (
            <CourseCardShell key={c.id} code={c.code} theme={c.theme} faculty={c.faculty} title={c.title} to={`/courses/${c.id}/graph`}
              footer={c.deadline && <span className="muted-s">{c.deadline}</span>}>
              <div className="course-lecturer">{t('lecturer')}: {c.lecturer}</div>
              <ProgressBar value={c.progress} />
              <div className="course-progress">{c.progress}% {t('completed')}</div>
              <div className="course-gap">{c.gap}</div>
            </CourseCardShell>
          ))}
        </div>
        <div className="page-size">{t('show')}
          <label className="select tiny"><select defaultValue="12"><option>12</option><option>24</option><option>48</option></select></label>
        </div>
      </main>
    </div>
  );
}

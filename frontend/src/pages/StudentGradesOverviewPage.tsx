import { useMemo, useState } from 'react';
import { Award, Search } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../features/common/useAsync';
import { AppHeader } from '../features/layout/AppHeader';
import { useLanguage } from '../features/i18n/LanguageContext';

export default function StudentGradesOverviewPage() {
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const { data, loading, error } = useAsync(() => api.getStudentGradeSummary(), []);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('all');
  const grades = data ?? [];
  const terms = [...new Set(grades.map((item) => item.term))].sort().reverse();
  const filtered = useMemo(() => grades.filter((item) => (
    (term === 'all' || item.term === term)
    && `${item.courseCode} ${item.courseTitle}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  )), [grades, query, term]);
  const publishedCount = grades.filter((item) => item.status === 'published').length;
  const completedCredits = grades
    .filter((item) => item.status === 'published')
    .reduce((sum, item) => sum + item.credits, 0);

  return (
    <div className="page">
      <AppHeader />
      <main className="container grades-overview-page">
        <div className="grades-overview-heading">
          <div>
            <span className="profile-kicker">{isVi ? 'Học tập' : 'Learning'}</span>
            <h1>{isVi ? 'Điểm tổng kết các môn học' : 'Course grades overview'}</h1>
            <p>{isVi ? 'Tổng hợp điểm cuối kỳ theo từng học phần và học kỳ.' : 'Final grades for all courses, grouped by academic term.'}</p>
          </div>
          <Award size={28} />
        </div>

        <div className="grades-overview-stats">
          <div><span>{isVi ? 'Môn đã có điểm' : 'Courses graded'}</span><strong>{publishedCount}/{grades.length}</strong></div>
          <div><span>{isVi ? 'Tín chỉ đã hoàn tất' : 'Credits completed'}</span><strong>{completedCredits}</strong></div>
        </div>

        <section className="grades-overview-card">
          <div className="grades-overview-toolbar">
            <label className="grades-search">
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isVi ? 'Tìm theo mã hoặc tên môn...' : 'Search by course code or name...'} />
            </label>
            <label className="grades-term-filter">
              <span>{isVi ? 'Học kỳ' : 'Term'}</span>
              <select value={term} onChange={(event) => setTerm(event.target.value)}>
                <option value="all">{isVi ? 'Tất cả học kỳ' : 'All terms'}</option>
                {terms.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
          </div>

          {error && <p className="form-error" role="alert">{error.message}</p>}
          {loading && <p className="muted">{isVi ? 'Đang tải bảng điểm...' : 'Loading grades...'}</p>}
          <div className="grades-overview-table-wrap">
            <table className="grades-overview-table">
              <thead>
                <tr>
                  <th>{isVi ? 'Học kỳ' : 'Term'}</th>
                  <th>{isVi ? 'Mã môn' : 'Course code'}</th>
                  <th>{isVi ? 'Tên môn học' : 'Course'}</th>
                  <th>{isVi ? 'Tín chỉ' : 'Credits'}</th>
                  <th>{isVi ? 'Điểm tổng kết' : 'Final score'}</th>
                  <th>{isVi ? 'Điểm chữ' : 'Letter grade'}</th>
                  <th>{isVi ? 'Trạng thái' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={`${item.term}-${item.courseId}`}>
                    <td>{item.term}</td>
                    <td><strong>{item.courseCode}</strong></td>
                    <td>{item.courseTitle}</td>
                    <td>{item.credits}</td>
                    <td className="final-grade-value">{item.finalScore === null ? '—' : `${item.finalScore.toLocaleString(isVi ? 'vi-VN' : 'en-US')} / ${item.maxScore}`}</td>
                    <td>{item.letterGrade ?? '—'}</td>
                    <td><span className={`overall-grade-status ${item.status}`}>
                      {isVi
                        ? ({ published: 'Đã công bố', in_progress: 'Đang học', incomplete: 'Chưa hoàn tất' }[item.status])
                        : ({ published: 'Published', in_progress: 'In progress', incomplete: 'Incomplete' }[item.status])}
                    </span></td>
                  </tr>
                ))}
                {!loading && !error && !filtered.length && (
                  <tr><td className="grades-overview-empty" colSpan={7}>{isVi ? 'Không có kết quả phù hợp.' : 'No matching grades.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

import { Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { useAsync } from '../features/common/useAsync';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { RosterStudent, TeacherCourseTopic, TeacherGradeRow } from '../types';

const TABS = [
  ['graph', 'Lộ trình'], ['content', 'Nội dung'], ['announcements', 'Thông báo'], ['students', 'Học viên'],
  ['grades', 'Điểm số'], ['assignments', 'Bài tập'], ['quizzes', 'Quiz'], ['attendance', 'Điểm danh'], ['files', 'Tệp'],
] as const;

export default function TeacherCourseDetailPage() {
  const { courseId = '', tab = 'content' } = useParams();
  const nav = useNavigate();
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const isVi = language === 'vi';
  const { data: courseData, error: coursesError } = useAsync(() => api.getTeacherCourses(), []);
  const { data: rosterData, loading: rosterLoading, error: rosterError } =
    useAsync<RosterStudent[]>(() => api.getTeacherRoster(courseId), [courseId]);
  const { data: gradebookData, loading: gradebookLoading, error: gradebookError } =
    useAsync<TeacherGradeRow[]>(() => api.getTeacherGradebook(courseId), [courseId]);
  const { data: topicData, loading: topicsLoading, error: topicsError } =
    useAsync<TeacherCourseTopic[]>(() => api.getTeacherCourseTopics(courseId), [courseId]);
  const roster = rosterData ?? [];
  const gradebook = gradebookData ?? [];
  const topics = topicData ?? [];
  const courseName = courseData?.find((course) => course.id === courseId)?.title ?? courseId;

  const students = useMemo(() => roster.filter((student) =>
    `${student.id} ${student.name}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [query, roster]);

  const selectTab = (id: string) => {
    nav(id === 'graph' ? `/teacher/courses/${courseId}/graph`
      : id === 'assignments' ? `/teacher/courses/${courseId}/assignments`
        : id === 'announcements' ? `/teacher/courses/${courseId}/announcements`
          : `/teacher/courses/${courseId}/${id}`);
  };

  return (
    <div className="page course-detail-page teacher-course-detail">
      <AppHeader />
      <main className="container course-detail-content">
        <h1>{courseName}</h1>
        {coursesError && <p className="form-error" role="alert">{coursesError.message}</p>}
        <div className="tabs-pill course-detail-tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => selectTab(id)}>
              {isVi ? label : ({
                graph: 'Path', content: 'Content', announcements: 'Announcements', students: 'Students',
                grades: 'Grades', assignments: 'Assignments', quizzes: 'Quizzes', attendance: 'Attendance', files: 'Files',
              } as Record<string, string>)[id]}
            </button>
          ))}
        </div>

        {tab === 'content' && (
          <section className="teacher-content-card">
            <h2>{isVi ? `Nội dung khóa học ${courseId}` : `${courseId} course content`}</h2>
            {topicsError && <p className="form-error" role="alert">{topicsError.message}</p>}
            {topicsLoading && <p className="muted">{isVi ? 'Đang tải nội dung...' : 'Loading course content...'}</p>}
            <div className="teacher-content-list">
              {topics.map((topic) => (
                <div key={topic.id}>
                  <b>{topic.number}</b>
                  <span>{isVi ? topic.titleVi : topic.titleEn}<small>{topic.resources.join(' · ')}</small></span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'students' && (
          <section className="teacher-students-card">
            <div className="teacher-students-heading">
              <div><Users size={18} /><strong>{isVi ? 'Danh sách học viên' : 'Student roster'} · {roster.length}</strong></div>
              <label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isVi ? 'Tìm học viên...' : 'Search students...'} /></label>
            </div>
            {rosterError && <p className="form-error" role="alert">{rosterError.message}</p>}
            {rosterLoading && <p className="muted">{isVi ? 'Đang tải danh sách...' : 'Loading roster...'}</p>}
            <div className="teacher-students-table-wrap">
              <table>
                <thead><tr>
                  <th>{isVi ? 'Mã học viên' : 'Student ID'}</th><th>{isVi ? 'Họ và tên' : 'Full name'}</th>
                  <th>{isVi ? 'Tình trạng' : 'Status'}</th><th>{isVi ? 'Tiến độ hoàn thiện lộ trình' : 'Learning path progress'}</th>
                </tr></thead>
                <tbody>{students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.id}</td><td><strong>{student.name}</strong></td>
                    <td><span className="student-status">{isVi ? (student.status === 'active' ? 'Đang học' : 'Đã rút') : student.status}</span></td>
                    <td><span className="student-progress">{student.progress}%</span></td>
                  </tr>
                ))}</tbody>
              </table>
              {!rosterLoading && !rosterError && !students.length && <p className="course-empty-section">{isVi ? 'Không tìm thấy học viên.' : 'No students found.'}</p>}
            </div>
          </section>
        )}

        {tab === 'grades' && (
          <section className="teacher-grades-card">
            <div className="teacher-students-heading"><div><strong>{isVi ? 'Bảng điểm toàn lớp' : 'Class gradebook'}</strong></div></div>
            {gradebookError && <p className="form-error" role="alert">{gradebookError.message}</p>}
            {gradebookLoading && <p className="muted">{isVi ? 'Đang tải bảng điểm...' : 'Loading gradebook...'}</p>}
            <div className="teacher-students-table-wrap">
              <table>
                <thead><tr><th>{isVi ? 'Mã SV' : 'Student ID'}</th><th>{isVi ? 'Họ tên' : 'Name'}</th><th>{isVi ? 'Giữa kỳ' : 'Midterm'}</th><th>BTL</th><th>{isVi ? 'Cuối kỳ' : 'Final'}</th><th>{isVi ? 'Điểm danh' : 'Attendance'}</th><th>{isVi ? 'Tổng' : 'Total'}</th></tr></thead>
                <tbody>{gradebook.map((student) => {
                  return (
                    <tr key={student.id}>
                      <td>{student.id}</td><td><strong>{student.name}</strong></td>
                      <td>{student.midterm ?? '—'}</td><td>{student.project ?? '—'}</td>
                      <td>{student.final ?? '—'}</td><td>{student.attendance === null ? '—' : `${student.attendance}%`}</td>
                      <td><strong>{student.totalScore === null ? '—' : student.totalScore.toFixed(1)}</strong></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

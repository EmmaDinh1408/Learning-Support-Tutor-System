import { Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { useAsync } from '../features/common/useAsync';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { RosterStudent, TeacherCourseTopic, TeacherGradeRow } from '../types';

const TABS = [
  ['graph', 'Lộ trình'],
  ['content', 'Nội dung'],
  ['announcements', 'Thông báo'],
  ['students', 'Học viên'],
  ['grades', 'Điểm số'],
  ['assignments', 'Bài tập'],
  ['quizzes', 'Quiz'],
  ['attendance', 'Điểm danh'],
  ['files', 'Tệp'],
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
  const [gradebook, setGradebook] = useState<TeacherGradeRow[]>([]);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [gradeDraft, setGradeDraft] = useState<{ midterm: string; project: string; final: string; attendance: string }>({
    midterm: '',
    project: '',
    final: '',
    attendance: '',
  });
  const [gradeMessage, setGradeMessage] = useState('');
  const [gradeError, setGradeError] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);

  useEffect(() => {
    if (gradebookData) setGradebook(gradebookData);
  }, [gradebookData]);

  const topics = topicData ?? [];
  const courseName = courseData?.find((course) => course.id === courseId)?.title ?? courseId;

  const students = useMemo(
    () =>
      roster.filter((student) =>
        `${student.id} ${student.name} ${student.email ?? ''}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [query, roster],
  );

  const selectTab = (id: string) => {
    nav(
      id === 'graph'
        ? `/teacher/courses/${courseId}/graph`
        : id === 'assignments'
          ? `/teacher/courses/${courseId}/assignments`
          : id === 'announcements'
            ? `/teacher/courses/${courseId}/announcements`
            : id === 'quizzes'
              ? `/teacher/courses/${courseId}/quizzes`
              : id === 'attendance'
                ? `/teacher/courses/${courseId}/attendance`
                : id === 'files'
                  ? `/teacher/courses/${courseId}/files`
                  : `/teacher/courses/${courseId}/${id}`,
    );
  };

  const startEditGrade = (student: TeacherGradeRow) => {
    setEditingStudentId(student.id);
    setGradeDraft({
      midterm: student.midterm !== null ? String(student.midterm) : '',
      project: student.project !== null ? String(student.project) : '',
      final: student.final !== null ? String(student.final) : '',
      attendance: student.attendance !== null ? String(student.attendance) : '',
    });
    setGradeError('');
    setGradeMessage('');
  };

  const saveGradeRow = async (studentId: string) => {
    const parseOpt = (val: string) => (val.trim() === '' ? null : Number(val));
    const midterm = parseOpt(gradeDraft.midterm);
    const project = parseOpt(gradeDraft.project);
    const final = parseOpt(gradeDraft.final);
    const attendance = parseOpt(gradeDraft.attendance);
    setSavingGrade(true);
    setGradeError('');
    setGradeMessage('');
    try {
      const updated = await api.updateTeacherGradebookRow(courseId, studentId, {
        midterm,
        project,
        final,
        attendance,
      });
      setGradebook((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setEditingStudentId(null);
      setGradeMessage(isVi ? `Đã cập nhật điểm cho ${updated.name}.` : `Updated grades for ${updated.name}.`);
    } catch (reason) {
      setGradeError(reason instanceof Error ? reason.message : 'Không thể lưu điểm.');
    } finally {
      setSavingGrade(false);
    }
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
              {isVi
                ? label
                : ({
                    graph: 'Path',
                    content: 'Content',
                    announcements: 'Announcements',
                    students: 'Students',
                    grades: 'Grades',
                    assignments: 'Assignments',
                    quizzes: 'Quizzes',
                    attendance: 'Attendance',
                    files: 'Files',
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
                  <span>
                    {isVi ? topic.titleVi : topic.titleEn}
                    <small>{topic.resources.join(' · ')}</small>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'students' && (
          <section className="teacher-students-card">
            <div className="teacher-students-heading">
              <div>
                <Users size={18} />
                <strong>
                  {isVi ? 'Danh sách học viên ghi danh' : 'Enrolled student roster'} · {roster.length}
                </strong>
              </div>
              <label>
                <Search size={14} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={isVi ? 'Tìm học viên theo mã, tên, email...' : 'Search students...'}
                />
              </label>
            </div>
            {rosterError && <p className="form-error" role="alert">{rosterError.message}</p>}
            {rosterLoading && <p className="muted">{isVi ? 'Đang tải danh sách...' : 'Loading roster...'}</p>}
            <div className="teacher-students-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{isVi ? 'Mã học viên' : 'Student ID'}</th>
                    <th>{isVi ? 'Họ và tên' : 'Full name'}</th>
                    <th>Email</th>
                    <th>{isVi ? 'Ngày ghi danh' : 'Enrolled at'}</th>
                    <th>{isVi ? 'Tình trạng' : 'Status'}</th>
                    <th>{isVi ? 'Tiến độ hoàn thiện lộ trình' : 'Learning path progress'}</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.id}</td>
                      <td><strong>{student.name}</strong></td>
                      <td>{student.email ?? '—'}</td>
                      <td>
                        {student.enrolledAt
                          ? new Date(student.enrolledAt).toLocaleDateString(isVi ? 'vi-VN' : 'en-US')
                          : '—'}
                      </td>
                      <td>
                        <span className="student-status">
                          {isVi ? (student.status === 'active' ? 'Đang học' : 'Đã rút') : student.status}
                        </span>
                      </td>
                      <td><span className="student-progress">{student.progress}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rosterLoading && !rosterError && !students.length && (
                <p className="course-empty-section">{isVi ? 'Không tìm thấy học viên.' : 'No students found.'}</p>
              )}
            </div>
          </section>
        )}

        {tab === 'grades' && (
          <section className="teacher-grades-card">
            <div className="teacher-students-heading">
              <div><strong>{isVi ? 'Bảng điểm toàn lớp' : 'Class gradebook'}</strong></div>
            </div>
            {gradebookError && <p className="form-error" role="alert">{gradebookError.message}</p>}
            {gradeError && <p className="form-error" role="alert">{gradeError}</p>}
            {gradeMessage && <p className="admin-success" role="status">{gradeMessage}</p>}
            {gradebookLoading && <p className="muted">{isVi ? 'Đang tải bảng điểm...' : 'Loading gradebook...'}</p>}
            <div className="teacher-students-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{isVi ? 'Mã SV' : 'Student ID'}</th>
                    <th>{isVi ? 'Họ tên' : 'Name'}</th>
                    <th>{isVi ? 'Giữa kỳ (30%)' : 'Midterm (30%)'}</th>
                    <th>BTL (25%)</th>
                    <th>{isVi ? 'Cuối kỳ (35%)' : 'Final (35%)'}</th>
                    <th>{isVi ? 'Điểm danh (10%)' : 'Attendance (10%)'}</th>
                    <th>{isVi ? 'Tổng' : 'Total'}</th>
                    <th>{isVi ? 'Thao tác' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {gradebook.map((student) => {
                    const isEditing = editingStudentId === student.id;
                    return (
                      <tr key={student.id}>
                        <td>{student.id}</td>
                        <td><strong>{student.name}</strong></td>
                        <td>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              style={{ width: 68 }}
                              value={gradeDraft.midterm}
                              onChange={(e) => setGradeDraft((d) => ({ ...d, midterm: e.target.value }))}
                            />
                          ) : (
                            student.midterm ?? '—'
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              style={{ width: 68 }}
                              value={gradeDraft.project}
                              onChange={(e) => setGradeDraft((d) => ({ ...d, project: e.target.value }))}
                            />
                          ) : (
                            student.project ?? '—'
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              style={{ width: 68 }}
                              value={gradeDraft.final}
                              onChange={(e) => setGradeDraft((d) => ({ ...d, final: e.target.value }))}
                            />
                          ) : (
                            student.final ?? '—'
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              style={{ width: 72 }}
                              value={gradeDraft.attendance}
                              onChange={(e) => setGradeDraft((d) => ({ ...d, attendance: e.target.value }))}
                            />
                          ) : (
                            student.attendance === null ? '—' : `${student.attendance}%`
                          )}
                        </td>
                        <td>
                          <strong>{student.totalScore === null ? '—' : student.totalScore.toFixed(1)}</strong>
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                type="button"
                                className="btn btn-primary sm"
                                disabled={savingGrade}
                                onClick={() => void saveGradeRow(student.id)}
                              >
                                {isVi ? 'Lưu' : 'Save'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline sm"
                                onClick={() => setEditingStudentId(null)}
                              >
                                {isVi ? 'Hủy' : 'Cancel'}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline sm"
                              onClick={() => startEditGrade(student)}
                            >
                              {isVi ? 'Nhập điểm' : 'Edit'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

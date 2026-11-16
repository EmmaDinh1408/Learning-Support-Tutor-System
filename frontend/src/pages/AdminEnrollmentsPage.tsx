import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import type { AdminCourseOption, AdminEnrollment, AdminStudentOption } from '../types';

export default function AdminEnrollmentsPage() {
  const [students, setStudents] = useState<AdminStudentOption[]>([]);
  const [courses, setCourses] = useState<AdminCourseOption[]>([]);
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([]);
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminEnrollments();
      setStudents(data.students);
      setCourses(data.courses);
      setEnrollments(data.enrollments);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu ghi danh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const addEnrollment = async () => {
    if (!studentId || !courseId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.createAdminEnrollment({ studentId, courseId });
      setStudentId('');
      setCourseId('');
      setMessage('Đã ghi danh sinh viên vào khóa học.');
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể ghi danh.');
    } finally {
      setBusy(false);
    }
  };

  const removeEnrollment = async (enrollment: AdminEnrollment) => {
    if (!window.confirm('Hủy ghi danh này?')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.deleteAdminEnrollment(enrollment.id);
      setEnrollments((current) => current.filter((item) => item.id !== enrollment.id));
      setMessage('Đã hủy ghi danh.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể hủy ghi danh.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <AppHeader />
      <main className="container admin-container">
        <div className="admin-heading">
          <div>
            <span className="profile-kicker">Quản trị</span>
            <h1 className="page-title">Ghi danh khóa học</h1>
            <p className="muted">Chỉ quản trị viên có thể thêm hoặc hủy ghi danh.</p>
          </div>
        </div>
        <section className="dashboard-section">
          <h2 className="admin-card-title">Ghi danh sinh viên</h2>
          <div className="admin-enrollment-form">
            <label className="field"><span>Sinh viên</span>
              <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                <option value="">Chọn sinh viên</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.email}</option>)}
              </select>
            </label>
            <label className="field"><span>Khóa học</span>
              <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                <option value="">Chọn khóa học</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title} ({course.semester} {course.year})</option>)}
              </select>
            </label>
            <button className="btn btn-primary" type="button" disabled={busy || !studentId || !courseId} onClick={() => void addEnrollment()}>
              {busy ? 'Đang xử lý...' : 'Ghi danh'}
            </button>
          </div>
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="admin-success" role="status">{message}</p>}
        <section className="dashboard-section admin-table-wrap">
          <h2 className="admin-card-title">Danh sách ghi danh</h2>
          {loading ? <p className="muted">Đang tải ghi danh...</p> : enrollments.length === 0 ? (
            <p className="muted">Chưa có ghi danh nào.</p>
          ) : (
            <table className="admin-table">
              <thead><tr><th>Sinh viên</th><th>Khóa học</th><th>Ngày ghi danh</th><th>Tiến độ</th><th></th></tr></thead>
              <tbody>
                {enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td>{enrollment.studentName}<small>{enrollment.studentEmail}</small></td>
                    <td>{enrollment.courseCode} · {enrollment.courseTitle}</td>
                    <td>{new Date(enrollment.enrolledAt).toLocaleDateString('vi-VN')}</td>
                    <td>{enrollment.progress}%</td>
                    <td><button className="btn btn-danger sm" type="button" disabled={busy} onClick={() => void removeEnrollment(enrollment)}>Hủy ghi danh</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

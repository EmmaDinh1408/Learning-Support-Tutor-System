import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import ProfileSettings from '../features/profile/ProfileSettings';
import type {
  AdminAnnouncementRecord,
  AdminCourseRecord,
  AdminStats,
  CourseTheme,
  Role,
} from '../types';

type ManagedRole = Exclude<Role, 'admin'> | 'admin';
type AdminSectionTab = 'overview' | 'courses' | 'announcements' | 'profile';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminSectionTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [courses, setCourses] = useState<AdminCourseRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncementRecord[]>([]);

  // Account creation state
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<ManagedRole>('student');
  const [initialPassword, setInitialPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Course management state
  const [editingCourse, setEditingCourse] = useState<AdminCourseRecord | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [courseFaculty, setCourseFaculty] = useState('Khoa Khoa học Máy tính');
  const [courseSemester, setCourseSemester] = useState('HK1');
  const [courseYear, setCourseYear] = useState(new Date().getFullYear());
  const [courseTheme, setCourseTheme] = useState<CourseTheme>('blue');
  const [courseLecturerId, setCourseLecturerId] = useState('');
  const [coursePublished, setCoursePublished] = useState(true);

  // Announcement management state
  const [editingAnnouncement, setEditingAnnouncement] = useState<AdminAnnouncementRecord | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annIsGlobal, setAnnIsGlobal] = useState(true);
  const [annCourseId, setAnnCourseId] = useState('');
  const [annStatus, setAnnStatus] = useState<'draft' | 'published'>('published');

  const loadAll = useCallback(async () => {
    try {
      const [statsData, coursesData, announcementsData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminCourses(),
        api.getAdminAnnouncements(),
      ]);
      setStats(statsData);
      setCourses(coursesData);
      setAnnouncements(announcementsData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu quản trị.');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const createAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (initialPassword.length < 8 || !/[A-Z]/.test(initialPassword) || !/[0-9]/.test(initialPassword)) {
      setError('Mật khẩu tạm thời cần ít nhất 8 ký tự, gồm 1 chữ hoa và 1 chữ số.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.createAdminUser({
        email: email.trim(),
        fullName: fullName.trim(),
        role,
        initialPassword,
      });
      setMessage(`Đã tạo tài khoản ${email.trim()}. Hãy gửi mật khẩu tạm thời cho người dùng qua kênh an toàn.`);
      setEmail('');
      setFullName('');
      setRole('student');
      setInitialPassword('');
      await loadAll();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tạo tài khoản.');
    } finally {
      setBusy(false);
    }
  };

  const resetCourseForm = () => {
    setEditingCourse(null);
    setCourseCode('');
    setCourseTitle('');
    setCourseDesc('');
    setCourseFaculty('Khoa Khoa học Máy tính');
    setCourseSemester('HK1');
    setCourseYear(new Date().getFullYear());
    setCourseTheme('blue');
    setCourseLecturerId('');
    setCoursePublished(true);
  };

  const startEditCourse = (course: AdminCourseRecord) => {
    setEditingCourse(course);
    setCourseCode(course.code);
    setCourseTitle(course.title);
    setCourseDesc(course.description ?? '');
    setCourseFaculty(course.faculty);
    setCourseSemester(course.semester);
    setCourseYear(course.year);
    setCourseTheme(course.theme);
    setCourseLecturerId(course.lecturerId ?? '');
    setCoursePublished(course.published);
  };

  const saveCourse = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !courseCode.trim() || !courseTitle.trim()) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (editingCourse) {
        const updated = await api.updateAdminCourse(editingCourse.id, {
          code: courseCode.trim().toUpperCase(),
          title: courseTitle.trim(),
          description: courseDesc.trim(),
          faculty: courseFaculty,
          semester: courseSemester.trim(),
          year: courseYear,
          theme: courseTheme,
          published: coursePublished,
          lecturerId: courseLecturerId || null,
        });
        setCourses((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setMessage(`Đã cập nhật khóa học ${updated.code}.`);
      } else {
        const created = await api.createAdminCourse({
          code: courseCode.trim().toUpperCase(),
          title: courseTitle.trim(),
          description: courseDesc.trim(),
          faculty: courseFaculty,
          semester: courseSemester.trim(),
          year: courseYear,
          theme: courseTheme,
          published: coursePublished,
          lecturerId: courseLecturerId || null,
        });
        setCourses((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        setMessage(`Đã tạo khóa học ${created.code}.`);
      }
      resetCourseForm();
      await loadAll();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu khóa học.');
    } finally {
      setBusy(false);
    }
  };

  const deleteCourse = async (course: AdminCourseRecord) => {
    if (!window.confirm(`Xóa khóa học ${course.code} - ${course.title}?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.deleteAdminCourse(course.id);
      setCourses((current) => current.filter((item) => item.id !== course.id));
      setMessage(`Đã xóa khóa học ${course.code}.`);
      await loadAll();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể xóa khóa học.');
    } finally {
      setBusy(false);
    }
  };

  const resetAnnouncementForm = () => {
    setEditingAnnouncement(null);
    setAnnTitle('');
    setAnnBody('');
    setAnnIsGlobal(true);
    setAnnCourseId('');
    setAnnStatus('published');
  };

  const startEditAnnouncement = (item: AdminAnnouncementRecord) => {
    setEditingAnnouncement(item);
    setAnnTitle(item.title);
    setAnnBody(item.body);
    setAnnIsGlobal(item.isGlobal);
    setAnnCourseId(item.courseId ?? '');
    setAnnStatus(item.status);
  };

  const saveAnnouncement = async (event: FormEvent) => {
    event.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (editingAnnouncement) {
        const updated = await api.updateAdminAnnouncement(editingAnnouncement.id, {
          title: annTitle.trim(),
          body: annBody.trim(),
          status: annStatus,
          isGlobal: annIsGlobal,
        });
        setAnnouncements((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setMessage('Đã cập nhật thông báo.');
      } else {
        const created = await api.createAdminAnnouncement({
          title: annTitle.trim(),
          body: annBody.trim(),
          isGlobal: annIsGlobal,
          courseId: annIsGlobal ? null : (annCourseId || null),
          status: annStatus,
        });
        setAnnouncements((current) => [created, ...current]);
        setMessage('Đã tạo thông báo mới.');
      }
      resetAnnouncementForm();
      await loadAll();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu thông báo.');
    } finally {
      setBusy(false);
    }
  };

  const deleteAnnouncement = async (item: AdminAnnouncementRecord) => {
    if (!window.confirm(`Xóa thông báo "${item.title}"?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.deleteAdminAnnouncement(item.id);
      setAnnouncements((current) => current.filter((entry) => entry.id !== item.id));
      setMessage('Đã xóa thông báo.');
      await loadAll();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể xóa thông báo.');
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
            <span className="profile-kicker">G4LMS · Quản trị</span>
            <h1 className="page-title">Bảng điều khiển Quản trị Hệ thống</h1>
            <p className="muted">Cấp tài khoản, quản lý khóa học, thông báo toàn trường và ghi danh học viên.</p>
          </div>
        </div>

        {/* Thống kê tổng quan (tương tự AdminDashboard trong bkelgialap) */}
        <section className="attendance-summary" style={{ marginBottom: 18 }}>
          <div>
            <span>Tổng Sinh viên</span>
            <strong>{stats?.students ?? 0}</strong>
          </div>
          <div>
            <span>Giảng viên</span>
            <strong>{stats?.teachers ?? 0}</strong>
          </div>
          <div>
            <span>Khóa học</span>
            <strong>{stats?.courses ?? courses.length}</strong>
          </div>
          <div>
            <span>Lượt ghi danh</span>
            <strong>{stats?.enrollments ?? 0}</strong>
          </div>
        </section>

        {/* Thanh chuyển mục Quản trị */}
        <div className="tabs-pill course-detail-tabs" style={{ marginBottom: 18 }}>
          <button type="button" className={activeTab === 'overview' ? 'on' : ''} onClick={() => setActiveTab('overview')}>
            Tạo tài khoản & Tổng quan
          </button>
          <button type="button" className={activeTab === 'courses' ? 'on' : ''} onClick={() => setActiveTab('courses')}>
            Quản lý Khóa học ({courses.length})
          </button>
          <button type="button" className={activeTab === 'announcements' ? 'on' : ''} onClick={() => setActiveTab('announcements')}>
            Thông báo Toàn trường ({announcements.length})
          </button>
          <button type="button" className={activeTab === 'profile' ? 'on' : ''} onClick={() => setActiveTab('profile')}>
            Hồ sơ & Đổi mật khẩu
          </button>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="admin-success" role="status">{message}</p>}

        {activeTab === 'overview' && (
          <section className="admin-grid">
            <article className="dashboard-section">
              <h2 className="admin-card-title">Tạo tài khoản mới</h2>
              <p className="muted">Người dùng phải đổi mật khẩu tạm thời sau lần đăng nhập đầu tiên.</p>
              <form className="admin-form" onSubmit={createAccount}>
                <label className="field">
                  <span>Họ và tên</span>
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={100} placeholder="Nguyễn Văn A" />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} placeholder="email@hcmut.edu.vn" />
                </label>
                <label className="field">
                  <span>Vai trò</span>
                  <select value={role} onChange={(event) => setRole(event.target.value as ManagedRole)}>
                    <option value="student">Sinh viên</option>
                    <option value="teacher">Giảng viên</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </label>
                <label className="field">
                  <span>Mật khẩu tạm thời</span>
                  <input type="password" autoComplete="new-password" value={initialPassword} onChange={(event) => setInitialPassword(event.target.value)} required minLength={8} placeholder="Ít nhất 8 ký tự, 1 chữ hoa, 1 chữ số" />
                </label>
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </form>
            </article>

            <div className="admin-shortcuts">
              <Link to="/admin/users" className="admin-shortcut">
                <strong>Quản lý Người dùng</strong>
                <span>Xem danh sách, tìm kiếm, đặt lại mật khẩu hoặc xóa tài khoản.</span>
              </Link>
              <Link to="/admin/enrollments" className="admin-shortcut">
                <strong>Quản lý Ghi danh</strong>
                <span>Gán sinh viên vào lớp học phần và theo dõi tiến độ ghi danh.</span>
              </Link>
              <button
                type="button"
                className="admin-shortcut"
                style={{ textAlign: 'left', cursor: 'pointer' }}
                onClick={() => setActiveTab('courses')}
              >
                <strong>Quản lý Khóa học</strong>
                <span>Tạo, chỉnh sửa, phân công giảng viên và xóa các lớp học phần.</span>
              </button>
              <button
                type="button"
                className="admin-shortcut"
                style={{ textAlign: 'left', cursor: 'pointer' }}
                onClick={() => setActiveTab('announcements')}
              >
                <strong>Thông báo Toàn trường</strong>
                <span>Đăng thông báo học vụ chung cho toàn bộ giảng viên và sinh viên.</span>
              </button>
            </div>
          </section>
        )}

        {activeTab === 'courses' && (
          <div style={{ display: 'grid', gap: 18 }}>
            <section className="dashboard-section">
              <h2 className="admin-card-title">{editingCourse ? `Chỉnh sửa khóa học · ${editingCourse.code}` : 'Tạo khóa học mới'}</h2>
              <form className="admin-form" onSubmit={saveCourse}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <label className="field">
                    <span>Mã khóa học *</span>
                    <input value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="VD: CO3001" required />
                  </label>
                  <label className="field">
                    <span>Tên khóa học *</span>
                    <input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="VD: Công nghệ Phần mềm" required />
                  </label>
                  <label className="field">
                    <span>Khoa</span>
                    <input value={courseFaculty} onChange={(e) => setCourseFaculty(e.target.value)} required />
                  </label>
                </div>
                <label className="field">
                  <span>Mô tả khóa học</span>
                  <input value={courseDesc} onChange={(e) => setCourseDesc(e.target.value)} placeholder="Mô tả tóm tắt nội dung môn học..." />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  <label className="field">
                    <span>Học kỳ</span>
                    <input value={courseSemester} onChange={(e) => setCourseSemester(e.target.value)} placeholder="HK1" required />
                  </label>
                  <label className="field">
                    <span>Năm học</span>
                    <input type="number" min={2000} max={2100} value={courseYear} onChange={(e) => setCourseYear(Number(e.target.value))} required />
                  </label>
                  <label className="field">
                    <span>Giảng viên phụ trách</span>
                    <select value={courseLecturerId} onChange={(e) => setCourseLecturerId(e.target.value)}>
                      <option value="">-- Chưa phân công --</option>
                      {(stats?.teachersList ?? []).map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name} ({teacher.email})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Màu chủ đề</span>
                    <select value={courseTheme} onChange={(e) => setCourseTheme(e.target.value as CourseTheme)}>
                      <option value="blue">Xanh dương (Blue)</option>
                      <option value="green">Xanh lá (Green)</option>
                      <option value="orange">Cam (Orange)</option>
                      <option value="slate">Xám (Slate)</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Trạng thái</span>
                    <select value={coursePublished ? 'published' : 'draft'} onChange={(e) => setCoursePublished(e.target.value === 'published')}>
                      <option value="published">Đã xuất bản</option>
                      <option value="draft">Bản nháp</option>
                    </select>
                  </label>
                </div>
                <div className="admin-row-actions">
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {editingCourse ? 'Lưu thay đổi' : 'Tạo khóa học'}
                  </button>
                  {editingCourse && (
                    <button className="btn btn-outline" type="button" onClick={resetCourseForm}>
                      Hủy chỉnh sửa
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="dashboard-section admin-table-wrap">
              <h2 className="admin-card-title">Danh sách tất cả khóa học</h2>
              {courses.length === 0 ? (
                <p className="muted">Chưa có khóa học nào.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Mã MH</th>
                      <th>Tên khóa học</th>
                      <th>Học kỳ</th>
                      <th>Giảng viên</th>
                      <th>Sinh viên</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course.id}>
                        <td><strong>{course.code}</strong></td>
                        <td>
                          {course.title}
                          {course.description && <small>{course.description}</small>}
                        </td>
                        <td>{course.semester} · {course.year}</td>
                        <td>{course.lecturerName || 'Chưa phân công'}</td>
                        <td>{course.students}</td>
                        <td>
                          <span className={`assignment-status ${course.published ? 'published' : 'draft'}`}>
                            {course.published ? 'Đã xuất bản' : 'Bản nháp'}
                          </span>
                        </td>
                        <td className="admin-row-actions">
                          <button className="btn btn-outline sm" type="button" onClick={() => startEditCourse(course)}>
                            Sửa
                          </button>
                          <button className="btn btn-danger sm" type="button" onClick={() => void deleteCourse(course)}>
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}

        {activeTab === 'announcements' && (
          <div style={{ display: 'grid', gap: 18 }}>
            <section className="dashboard-section">
              <h2 className="admin-card-title">
                {editingAnnouncement ? 'Chỉnh sửa thông báo' : 'Tạo thông báo mới (Toàn trường / Khóa học)'}
              </h2>
              <form className="admin-form" onSubmit={saveAnnouncement}>
                <label className="field">
                  <span>Tiêu đề thông báo *</span>
                  <input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} required maxLength={160} placeholder="Nhập tiêu đề thông báo..." />
                </label>
                <label className="field">
                  <span>Nội dung thông báo *</span>
                  <textarea rows={4} value={annBody} onChange={(e) => setAnnBody(e.target.value)} required maxLength={5000} placeholder="Nhập nội dung chi tiết..." />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <label className="field">
                    <span>Phạm vi thông báo</span>
                    <select value={annIsGlobal ? 'global' : 'course'} onChange={(e) => setAnnIsGlobal(e.target.value === 'global')}>
                      <option value="global">Thông báo toàn trường</option>
                      <option value="course">Theo khóa học cụ thể</option>
                    </select>
                  </label>
                  {!annIsGlobal && (
                    <label className="field">
                      <span>Chọn khóa học</span>
                      <select value={annCourseId} onChange={(e) => setAnnCourseId(e.target.value)} required>
                        <option value="">-- Chọn khóa học --</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.code} - {course.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="field">
                    <span>Trạng thái</span>
                    <select value={annStatus} onChange={(e) => setAnnStatus(e.target.value as 'draft' | 'published')}>
                      <option value="published">Đăng ngay</option>
                      <option value="draft">Lưu nháp</option>
                    </select>
                  </label>
                </div>
                <div className="admin-row-actions">
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {editingAnnouncement ? 'Cập nhật thông báo' : 'Đăng thông báo'}
                  </button>
                  {editingAnnouncement && (
                    <button className="btn btn-outline" type="button" onClick={resetAnnouncementForm}>
                      Hủy chỉnh sửa
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="dashboard-section">
              <h2 className="admin-card-title">Danh sách thông báo hệ thống</h2>
              {announcements.length === 0 ? (
                <p className="muted">Chưa có thông báo nào.</p>
              ) : (
                <div className="announcement-list">
                  {announcements.map((item) => (
                    <article className="announcement-card" key={item.id}>
                      <div className="announcement-card-heading">
                        <h2>{item.title}</h2>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className="assignment-status published">
                            {item.isGlobal ? 'Toàn trường' : item.courseName}
                          </span>
                          <span className={`assignment-status ${item.status}`}>
                            {item.status === 'published' ? 'Đã đăng' : 'Bản nháp'}
                          </span>
                        </div>
                      </div>
                      <p>{item.body}</p>
                      <div className="announcement-card-footer">
                        <span className="muted-s">
                          {item.authorName} · {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                        <div className="admin-row-actions">
                          <button className="btn btn-outline sm" type="button" onClick={() => startEditAnnouncement(item)}>
                            Sửa
                          </button>
                          <button className="btn btn-danger sm" type="button" onClick={() => void deleteAnnouncement(item)}>
                            Xóa
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'profile' && <ProfileSettings />}
      </main>
    </div>
  );
}

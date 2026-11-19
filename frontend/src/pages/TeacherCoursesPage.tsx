import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { CourseToolbar } from '../features/courses/CourseToolbar';
import { CourseCardShell } from '../features/courses/CourseCardShell';
import { ProgressBar } from '../features/common/ProgressBar';
import { useAsync } from '../features/common/useAsync';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { CourseTheme, TeacherCourse } from '../types';

export default function TeacherCoursesPage() {
  const { language, t } = useLanguage();
  const isVi = language === 'vi';
  const statusOptions = isVi
    ? ['Tất cả (trừ đã ẩn)', 'Đã xuất bản', 'Chưa xuất bản']
    : ['All (except hidden)', 'Published', 'Unpublished'];
  const { data, error, loading } = useAsync(() => api.getTeacherCourses(), []);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState(statusOptions[0]);
  const [sortBy, setSortBy] = useState('title');
  const [courses, setCourses] = useState(data ?? []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TeacherCourse | null>(null);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [faculty, setFaculty] = useState('Khoa Khoa học Máy tính');
  const [semester, setSemester] = useState(new Date().getMonth() < 6 ? 'HK2' : 'HK1');
  const [year, setYear] = useState(new Date().getFullYear());
  const [theme, setTheme] = useState<CourseTheme>('blue');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setCourses(data);
  }, [data]);

  const openCreateModal = () => {
    setEditingCourse(null);
    setCode('');
    setTitle('');
    setDescription('');
    setFaculty('Khoa Khoa học Máy tính');
    setSemester(new Date().getMonth() < 6 ? 'HK2' : 'HK1');
    setYear(new Date().getFullYear());
    setTheme('blue');
    setActionError('');
    setModalOpen(true);
  };

  const openEditModal = (course: TeacherCourse) => {
    setEditingCourse(course);
    setCode(course.code);
    setTitle(course.title);
    setDescription(course.description ?? '');
    setFaculty(course.faculty);
    setSemester(course.semester ?? 'HK1');
    setYear(course.year ?? new Date().getFullYear());
    setTheme(course.theme);
    setActionError('');
    setModalOpen(true);
  };

  const saveCourse = async () => {
    if (saving || !code.trim() || !title.trim()) return;
    setSaving(true);
    setActionError('');
    setActionMessage('');
    try {
      if (editingCourse) {
        const updated = await api.updateTeacherCourse(editingCourse.id, {
          code: code.trim().toUpperCase(),
          title: title.trim(),
          description: description.trim(),
          faculty,
          semester,
          year,
          theme,
        });
        setCourses((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setActionMessage(isVi ? `Đã cập nhật khóa học ${updated.code}.` : `Updated course ${updated.code}.`);
      } else {
        const course = await api.createTeacherCourse({
          code: code.trim().toUpperCase(),
          title: title.trim(),
          description: description.trim(),
          faculty,
          semester,
          year,
          theme,
        });
        setCourses((current) => [course, ...current.filter((item) => item.id !== course.id)]);
        setActionMessage(isVi ? `Đã tạo khóa học ${course.code}.` : `Created course ${course.code}.`);
      }
      setModalOpen(false);
      setEditingCourse(null);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể lưu khóa học.');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (course: TeacherCourse) => {
    setActionError('');
    setActionMessage('');
    try {
      const updated = await api.updateTeacherCourse(course.id, { published: !course.published });
      setCourses((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể cập nhật trạng thái xuất bản.');
    }
  };

  const removeCourse = async (course: TeacherCourse) => {
    if (!window.confirm(isVi ? `Xóa khóa học ${course.code} - ${course.title}?` : `Delete course ${course.code}?`)) return;
    setActionError('');
    setActionMessage('');
    try {
      await api.deleteTeacherCourse(course.id);
      setCourses((current) => current.filter((item) => item.id !== course.id));
      setActionMessage(isVi ? `Đã xóa khóa học ${course.code}.` : `Deleted course ${course.code}.`);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể xóa khóa học.');
    }
  };

  const list = courses
    .filter((c) => `${c.code} ${c.title}`.toLowerCase().includes(q.toLowerCase()))
    .filter((c) => {
      if (statusFilter === statusOptions[1]) return c.published;
      if (statusFilter === statusOptions[2]) return !c.published;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'progress') {
        const pA = a.totalNodes ? a.nodesWithContent / a.totalNodes : 0;
        const pB = b.totalNodes ? b.nodesWithContent / b.totalNodes : 0;
        return pB - pA;
      }
      return a.title.localeCompare(b.title);
    });

  return (
    <div className="page">
      <AppHeader />
      <main className="container">
        <h1 className="page-title">{t('courses')}</h1>
        <CourseToolbar
          teacher
          statusOptions={statusOptions}
          statusValue={statusFilter}
          onStatusChange={setStatusFilter}
          sortValue={sortBy}
          onSortChange={setSortBy}
          query={q}
          onQuery={setQ}
          onCreate={openCreateModal}
        />
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {actionMessage && <p className="admin-success" role="status">{actionMessage}</p>}
        {error && <p className="form-error" role="alert">{error.message}</p>}
        {loading && <p className="muted">{isVi ? 'Đang tải khóa học...' : 'Loading courses...'}</p>}
        <div className="course-grid">
          {list.map((c) => (
            <CourseCardShell
              key={c.id}
              code={c.code}
              theme={c.theme}
              faculty={c.faculty}
              title={c.title}
              to={`/teacher/courses/${c.id}/graph`}
              footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 6 }}>
                  <span className="node-count">
                    {c.nodesWithContent}/{c.totalNodes} {isVi ? 'node có nội dung' : 'nodes with content'}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn-outline sm"
                      onClick={(e) => {
                        e.preventDefault();
                        void togglePublish(c);
                      }}
                    >
                      {c.published ? (isVi ? 'Ẩn' : 'Unpublish') : (isVi ? 'Xuất bản' : 'Publish')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline sm"
                      onClick={(e) => {
                        e.preventDefault();
                        openEditModal(c);
                      }}
                    >
                      {isVi ? 'Sửa' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger sm"
                      onClick={(e) => {
                        e.preventDefault();
                        void removeCourse(c);
                      }}
                    >
                      {isVi ? 'Xóa' : 'Delete'}
                    </button>
                  </div>
                </div>
              }
            >
              <div className="course-meta">
                {c.students} {isVi ? 'học viên' : 'students'}
                {c.pending ? <b className="pending">{c.pending} {isVi ? 'chờ duyệt' : 'pending'}</b> : null}
                {!c.published && <span className="unpub">{t('draft')}</span>}
              </div>
              {c.description && <p className="muted-s" style={{ margin: '4px 0' }}>{c.description}</p>}
              <ProgressBar value={c.totalNodes ? (c.nodesWithContent / c.totalNodes) * 100 : 0} />
            </CourseCardShell>
          ))}
        </div>
      </main>
      {modalOpen && (
        <div className="course-modal-backdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <div className="course-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <h2>
              {editingCourse
                ? (isVi ? 'Chỉnh sửa khóa học' : 'Edit course')
                : (isVi ? 'Tạo khóa học mới' : 'Create course')}
            </h2>
            <label>
              {isVi ? 'Mã khóa học' : 'Course code'}
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: CO3094" />
            </label>
            <label>
              {isVi ? 'Tên khóa học' : 'Course title'}
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: An ninh mạng" />
            </label>
            <label>
              {isVi ? 'Mô tả' : 'Description'}
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isVi ? 'Mô tả ngắn gọn về khóa học...' : 'Course summary...'} />
            </label>
            <label>
              {isVi ? 'Khoa' : 'Faculty'}
              <select value={faculty} onChange={(e) => setFaculty(e.target.value)}>
                <option>Khoa Khoa học Máy tính</option>
                <option>Khoa Khoa học Ứng dụng</option>
                <option>Khoa Điện - Điện tử</option>
              </select>
            </label>
            <label>
              {isVi ? 'Học kỳ' : 'Semester'}
              <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                <option value="HK1">HK1</option>
                <option value="HK2">HK2</option>
                <option value="Hè">Hè</option>
              </select>
            </label>
            <label>
              {isVi ? 'Năm học' : 'Academic year'}
              <input type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </label>
            <label>
              {isVi ? 'Màu sắc' : 'Theme'}
              <select value={theme} onChange={(e) => setTheme(e.target.value as CourseTheme)}>
                <option value="blue">Xanh dương (Blue)</option>
                <option value="green">Xanh lá (Green)</option>
                <option value="orange">Cam (Orange)</option>
                <option value="slate">Xám (Slate)</option>
              </select>
            </label>
            <div className="course-modal-actions">
              <button className="btn btn-outline" onClick={() => setModalOpen(false)}>
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button className="btn btn-primary" disabled={saving || !code.trim() || !title.trim()} onClick={saveCourse}>
                {editingCourse ? (isVi ? 'Cập nhật' : 'Save changes') : (isVi ? 'Tạo khóa học' : 'Create course')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

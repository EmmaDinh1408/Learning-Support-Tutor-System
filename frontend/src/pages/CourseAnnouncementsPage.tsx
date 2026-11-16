import { useEffect, useState, type FormEvent } from 'react';
import { Megaphone } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { useAsync } from '../features/common/useAsync';
import { AppHeader } from '../features/layout/AppHeader';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { Announcement } from '../types';

export default function CourseAnnouncementsPage() {
  const { courseId = '' } = useParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isTeacher = user?.role === 'teacher';
  const isVi = language === 'vi';
  const { data, loading, error } = useAsync(
    () => api.getAnnouncements(courseId, isTeacher ? 'teacher' : 'student'),
    [courseId, isTeacher],
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    if (data) setAnnouncements(data);
  }, [data]);

  const resetForm = () => {
    setEditingItem(null);
    setTitle('');
    setBody('');
  };

  const startEdit = (item: Announcement) => {
    setEditingItem(item);
    setTitle(item.title);
    setBody(item.body);
    setActionError('');
    setActionMessage('');
  };

  const saveAnnouncement = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      if (editingItem) {
        const updated = await api.updateAnnouncement(courseId, editingItem.id, {
          title: title.trim(),
          body: body.trim(),
        });
        setAnnouncements((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setActionMessage(isVi ? 'Đã cập nhật thông báo.' : 'Announcement updated.');
      } else {
        const item = await api.createAnnouncement(courseId, { title: title.trim(), body: body.trim() });
        setAnnouncements((current) => [item, ...current]);
        setActionMessage(isVi ? 'Đã lưu bản nháp thông báo.' : 'Draft announcement saved.');
      }
      resetForm();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể lưu thông báo.');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (item: Announcement) => {
    setActionError('');
    setActionMessage('');
    try {
      const updated = await api.updateAnnouncementStatus(
        courseId,
        item.id,
        item.status === 'published' ? 'draft' : 'published',
      );
      setAnnouncements((current) => current.map((announcement) => (announcement.id === updated.id ? updated : announcement)));
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể cập nhật thông báo.');
    }
  };

  const removeAnnouncement = async (item: Announcement) => {
    if (!window.confirm(isVi ? `Xóa thông báo "${item.title}"?` : `Delete announcement "${item.title}"?`)) return;
    setActionError('');
    setActionMessage('');
    try {
      await api.deleteAnnouncement(courseId, item.id);
      setAnnouncements((current) => current.filter((entry) => entry.id !== item.id));
      if (editingItem?.id === item.id) resetForm();
      setActionMessage(isVi ? 'Đã xóa thông báo.' : 'Announcement deleted.');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể xóa thông báo.');
    }
  };

  return (
    <div className="page">
      <AppHeader />
      <main className="container announcements-page">
        <Link className="quiz-back" to={isTeacher ? `/teacher/courses/${courseId}/content` : `/courses/${courseId}/content`}>
          {isVi ? '← Quay lại nội dung môn học' : '← Back to course content'}
        </Link>
        <div className="assignments-heading">
          <div>
            <span className="profile-kicker">{courseId}</span>
            <h1>{isVi ? 'Thông báo môn học' : 'Course announcements'}</h1>
          </div>
          <Megaphone size={24} />
        </div>

        {(error || actionError) && <p className="form-error" role="alert">{actionError || error?.message}</p>}
        {actionMessage && <p className="admin-success" role="status">{actionMessage}</p>}
        {loading && <p className="muted">{isVi ? 'Đang tải thông báo...' : 'Loading announcements...'}</p>}

        {isTeacher && (
          <form className="assignment-create-card" onSubmit={saveAnnouncement}>
            <h2>{editingItem ? (isVi ? 'Chỉnh sửa thông báo' : 'Edit announcement') : (isVi ? 'Soạn thông báo' : 'Write an announcement')}</h2>
            <label>
              {isVi ? 'Tiêu đề' : 'Title'}
              <input required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              {isVi ? 'Nội dung' : 'Message'}
              <textarea required maxLength={10000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={busy || !title.trim() || !body.trim()}>
                {editingItem ? (isVi ? 'Cập nhật' : 'Save changes') : (isVi ? 'Lưu bản nháp' : 'Save draft')}
              </button>
              {editingItem && (
                <button type="button" className="btn btn-outline" onClick={resetForm}>
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
              )}
            </div>
          </form>
        )}

        <div className="announcement-list">
          {announcements.map((item) => (
            <article className="announcement-card" key={item.id}>
              <div className="announcement-card-heading">
                <h2>{item.title}</h2>
                {isTeacher && (
                  <span className={`assignment-status ${item.status}`}>
                    {isVi ? (item.status === 'published' ? 'Đã đăng' : 'Bản nháp') : item.status}
                  </span>
                )}
              </div>
              <p>{item.body}</p>
              <div className="announcement-card-footer">
                <time dateTime={item.publishedAt ?? item.createdAt}>
                  {item.authorName ? `${item.authorName} · ` : ''}
                  {new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', { dateStyle: 'medium' }).format(
                    new Date(item.publishedAt ?? item.createdAt),
                  )}
                </time>
                {isTeacher && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline sm" type="button" onClick={() => void updateStatus(item)}>
                      {item.status === 'published' ? (isVi ? 'Gỡ thông báo' : 'Unpublish') : (isVi ? 'Đăng thông báo' : 'Publish')}
                    </button>
                    <button className="btn btn-outline sm" type="button" onClick={() => startEdit(item)}>
                      {isVi ? 'Sửa' : 'Edit'}
                    </button>
                    <button className="btn btn-danger sm" type="button" onClick={() => void removeAnnouncement(item)}>
                      {isVi ? 'Xóa' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {!loading && !error && !announcements.length && (
            <div className="assignment-empty">{isVi ? 'Chưa có thông báo nào.' : 'No announcements yet.'}</div>
          )}
        </div>
      </main>
    </div>
  );
}

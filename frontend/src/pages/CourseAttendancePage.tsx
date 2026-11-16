import { CalendarCheck, Check, Trash2, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { AppHeader } from '../features/layout/AppHeader';
import { useAsync } from '../features/common/useAsync';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { AttendanceEntry, AttendanceSession, AttendanceStatus } from '../types';

const STATUS_LABELS: Record<AttendanceStatus, { vi: string; en: string }> = {
  unmarked: { vi: 'Chưa điểm danh', en: 'Unmarked' },
  present: { vi: 'Có mặt', en: 'Present' },
  absent: { vi: 'Vắng', en: 'Absent' },
  late: { vi: 'Đi trễ', en: 'Late' },
  excused: { vi: 'Có phép', en: 'Excused' },
};

function isAttendanceStatus(value: string): value is AttendanceStatus {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, value);
}

function localDateValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function CourseAttendancePage() {
  const { courseId = '' } = useParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const isTeacher = user?.role === 'teacher';
  const { data: teacherData, loading: teacherLoading, error: teacherError } = useAsync(
    () => (isTeacher ? api.getTeacherAttendance(courseId) : Promise.resolve(null)),
    [courseId, isTeacher],
  );
  const { data: studentData, loading: studentLoading, error: studentError } = useAsync(
    () => (isTeacher ? Promise.resolve(null) : api.getStudentAttendance(courseId)),
    [courseId, isTeacher],
  );
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [records, setRecords] = useState<AttendanceEntry[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDateValue);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (teacherData) {
      setSessions(teacherData);
      setSelectedId((current) => current || teacherData[0]?.id || '');
    }
  }, [teacherData]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedId),
    [sessions, selectedId],
  );

  useEffect(() => {
    setRecords(selectedSession?.records ?? []);
  }, [selectedSession]);

  const createSession = async (event: FormEvent) => {
    event.preventDefault();
    setActionError('');
    setActionMessage('');
    setBusy(true);
    try {
      const session = await api.createAttendanceSession(courseId, { title: title.trim(), date });
      setSessions((current) => [session, ...current]);
      setSelectedId(session.id);
      setTitle('');
      setActionMessage(isVi ? 'Đã tạo buổi điểm danh.' : 'Attendance session created.');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : (isVi ? 'Không thể tạo buổi điểm danh.' : 'Unable to create attendance session.'));
    } finally {
      setBusy(false);
    }
  };

  const updateRecord = (studentId: string, status: AttendanceStatus) => {
    setRecords((current) => current.map((record) => (record.studentId === studentId ? { ...record, status } : record)));
  };

  const updateNote = (studentId: string, note: string) => {
    setRecords((current) => current.map((record) => (record.studentId === studentId ? { ...record, note } : record)));
  };

  const markAllPresent = () => setRecords((current) => current.map((record) => ({ ...record, status: 'present' })));

  const saveSession = async (status: AttendanceSession['status']) => {
    if (!selectedSession) return;
    setActionError('');
    setActionMessage('');
    setBusy(true);
    try {
      const updated = await api.updateAttendanceSession(courseId, selectedSession.id, { records, status });
      setSessions((current) => current.map((session) => (session.id === updated.id ? updated : session)));
      setActionMessage(
        status === 'published'
          ? (isVi ? 'Đã lưu và công bố điểm danh.' : 'Attendance published.')
          : (isVi ? 'Đã lưu nháp điểm danh.' : 'Attendance draft saved.'),
      );
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : (isVi ? 'Không thể lưu điểm danh.' : 'Unable to save attendance.'));
    } finally {
      setBusy(false);
    }
  };

  const removeSession = async (session: AttendanceSession) => {
    if (!window.confirm(isVi ? `Xóa buổi điểm danh "${session.title}" (${session.date})?` : `Delete session "${session.title}"?`)) return;
    setActionError('');
    setActionMessage('');
    setBusy(true);
    try {
      await api.deleteAttendanceSession(courseId, session.id);
      const next = sessions.filter((item) => item.id !== session.id);
      setSessions(next);
      setSelectedId(next[0]?.id ?? '');
      setActionMessage(isVi ? 'Đã xóa buổi điểm danh.' : 'Attendance session deleted.');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể xóa buổi điểm danh.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <AppHeader />
      <main className="container course-attendance-page">
        <Link className="quiz-back" to={isTeacher ? `/teacher/courses/${courseId}/content` : `/courses/${courseId}/content`}>
          {isVi ? '← Quay lại nội dung môn học' : '← Back to course content'}
        </Link>
        <div className="assignments-heading">
          <div>
            <span className="profile-kicker">{courseId}</span>
            <h1>{isVi ? 'Điểm danh' : 'Attendance'}</h1>
          </div>
          <span className="assignment-count"><CalendarCheck size={15} />{isTeacher ? sessions.length : studentData?.totalSessions ?? 0}</span>
        </div>
        {(teacherError || studentError) && <p className="form-error" role="alert">{teacherError?.message ?? studentError?.message}</p>}
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {actionMessage && <p className="admin-success" role="status">{actionMessage}</p>}

        {isTeacher ? (
          <>
            <form className="attendance-create-card" onSubmit={createSession}>
              <h2>{isVi ? 'Tạo buổi điểm danh' : 'Create attendance session'}</h2>
              <label>{isVi ? 'Tên buổi học' : 'Session title'}
                <input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label>{isVi ? 'Ngày học' : 'Class date'}
                <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>
                <CalendarCheck size={14} />{isVi ? 'Tạo danh sách' : 'Create roster'}
              </button>
            </form>

            {teacherLoading && <p className="muted">{isVi ? 'Đang tải buổi điểm danh...' : 'Loading attendance sessions...'}</p>}
            <div className="attendance-workspace">
              <aside className="attendance-session-list">
                <h2>{isVi ? 'Các buổi học' : 'Sessions'}</h2>
                {sessions.map((session) => (
                  <button
                    type="button"
                    key={session.id}
                    className={selectedId === session.id ? 'active' : ''}
                    onClick={() => setSelectedId(session.id)}
                  >
                    <strong>{session.title}</strong>
                    <span>{session.date} · {session.status === 'published' ? (isVi ? 'Đã công bố' : 'Published') : (isVi ? 'Bản nháp' : 'Draft')}</span>
                  </button>
                ))}
                {!teacherLoading && !sessions.length && <p className="muted">{isVi ? 'Chưa có buổi điểm danh.' : 'No attendance sessions yet.'}</p>}
              </aside>

              {selectedSession && (
                <section className="attendance-roster-card">
                  <div className="attendance-roster-heading">
                    <div>
                      <h2>{selectedSession.title}</h2>
                      <p>{selectedSession.date} · {records.length} {isVi ? 'học viên' : 'students'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn btn-outline sm" onClick={markAllPresent} disabled={busy}>
                        <UserCheck size={13} />{isVi ? 'Đánh dấu tất cả có mặt' : 'Mark all present'}
                      </button>
                      <button type="button" className="btn btn-danger sm" onClick={() => void removeSession(selectedSession)} disabled={busy}>
                        <Trash2 size={13} />{isVi ? 'Xóa buổi' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  <div className="attendance-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{isVi ? 'Mã học viên' : 'Student ID'}</th>
                          <th>{isVi ? 'Họ và tên' : 'Name'}</th>
                          <th>{isVi ? 'Trạng thái' : 'Status'}</th>
                          <th>{isVi ? 'Ghi chú' : 'Note'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.studentId}>
                            <td>{record.studentId}</td>
                            <td>{record.name}</td>
                            <td>
                              <select
                                value={record.status}
                                disabled={busy}
                                onChange={(event) => {
                                  if (isAttendanceStatus(event.target.value)) updateRecord(record.studentId, event.target.value);
                                }}
                              >
                                {(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map((status) => (
                                  <option value={status} key={status}>{isVi ? STATUS_LABELS[status].vi : STATUS_LABELS[status].en}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                value={record.note ?? ''}
                                disabled={busy}
                                placeholder={isVi ? 'Ghi chú (tùy chọn)' : 'Optional note'}
                                onChange={(event) => updateNote(record.studentId, event.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="attendance-actions">
                    {selectedSession.status === 'draft' && (
                      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void saveSession('draft')}>
                        {isVi ? 'Lưu nháp' : 'Save draft'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy || records.some((record) => record.status === 'unmarked')}
                      onClick={() => void saveSession('published')}
                    >
                      <Check size={14} />
                      {selectedSession.status === 'published'
                        ? (isVi ? 'Lưu và cập nhật' : 'Save changes')
                        : (isVi ? 'Công bố điểm danh' : 'Publish attendance')}
                    </button>
                  </div>
                </section>
              )}
            </div>
          </>
        ) : (
          <>
            {studentLoading && <p className="muted">{isVi ? 'Đang tải kết quả điểm danh...' : 'Loading attendance...'}</p>}
            {studentData && (
              <>
                <section className="attendance-summary">
                  <div><span>{isVi ? 'Tỷ lệ tham dự' : 'Attendance rate'}</span><strong>{studentData.attendanceRate}%</strong></div>
                  <div><span>{isVi ? 'Có mặt' : 'Present'}</span><strong>{studentData.present}</strong></div>
                  <div><span>{isVi ? 'Vắng' : 'Absent'}</span><strong>{studentData.absent}</strong></div>
                  <div><span>{isVi ? 'Đi trễ / có phép' : 'Late / excused'}</span><strong>{studentData.late + studentData.excused}</strong></div>
                </section>
                <section className="attendance-student-records">
                  <h2>{isVi ? 'Lịch sử điểm danh' : 'Attendance history'}</h2>
                  {studentData.records.map((record) => (
                    <article key={record.sessionId}>
                      <div><strong>{record.title}</strong><span>{record.date}</span></div>
                      <span className={`attendance-status ${record.status}`}>{isVi ? STATUS_LABELS[record.status].vi : STATUS_LABELS[record.status].en}</span>
                    </article>
                  ))}
                  {!studentData.records.length && <p className="muted">{isVi ? 'Chưa có kết quả điểm danh được công bố.' : 'No published attendance records.'}</p>}
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

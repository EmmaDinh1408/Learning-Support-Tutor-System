import { useEffect, useState, type FormEvent } from 'react';
import { ClipboardList, Clock3, Send } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { useAuth } from '../features/auth/AuthContext';
import { useAsync } from '../features/common/useAsync';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { Assignment, AssignmentStatus, AssignmentSubmissionRecord } from '../types';

function formatDueDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CourseAssignmentsPage() {
  const { courseId = '' } = useParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isTeacher = user?.role === 'teacher';
  const isVi = language === 'vi';
  const { data, loading, error } = useAsync(
    () => api.getAssignments(courseId, isTeacher ? 'teacher' : 'student'),
    [courseId, isTeacher],
  );
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxScore, setMaxScore] = useState('10');
  const [submissionText, setSubmissionText] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Teacher grading state
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const [submissionsByAssignment, setSubmissionsByAssignment] = useState<Record<string, AssignmentSubmissionRecord[]>>({});
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { score: string; feedback: string }>>({});

  useEffect(() => {
    if (data) setAssignments(data);
  }, [data]);

  const resetForm = () => {
    setEditingAssignment(null);
    setTitle('');
    setDescription('');
    setDueAt('');
    setMaxScore('10');
  };

  const startEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setTitle(assignment.title);
    setDescription(assignment.description);
    setDueAt(toDatetimeLocalValue(assignment.dueAt));
    setMaxScore(String(assignment.maxScore));
    setActionError('');
    setActionMessage('');
  };

  const saveAssignment = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      if (editingAssignment) {
        const updated = await api.updateAssignment(courseId, editingAssignment.id, {
          title: title.trim(),
          description: description.trim(),
          dueAt: new Date(dueAt).toISOString(),
          maxScore: Number(maxScore),
        });
        setAssignments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setActionMessage(isVi ? 'Đã cập nhật bài tập.' : 'Assignment updated.');
      } else {
        const item = await api.createAssignment(courseId, {
          title: title.trim(),
          description: description.trim(),
          dueAt: new Date(dueAt).toISOString(),
          maxScore: Number(maxScore),
        });
        setAssignments((current) => [item, ...current]);
        setActionMessage(isVi ? 'Đã tạo bản nháp bài tập.' : 'Draft assignment created.');
      }
      resetForm();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể lưu bài tập.');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (assignment: Assignment, status: AssignmentStatus) => {
    setActionError('');
    setActionMessage('');
    try {
      const updated = await api.updateAssignmentStatus(courseId, assignment.id, status);
      setAssignments((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể cập nhật bài tập.');
    }
  };

  const removeAssignment = async (assignment: Assignment) => {
    if (!window.confirm(isVi ? `Xóa bài tập "${assignment.title}"?` : `Delete assignment "${assignment.title}"?`)) return;
    setActionError('');
    setActionMessage('');
    try {
      await api.deleteAssignment(courseId, assignment.id);
      setAssignments((current) => current.filter((item) => item.id !== assignment.id));
      if (editingAssignment?.id === assignment.id) resetForm();
      setActionMessage(isVi ? 'Đã xóa bài tập.' : 'Assignment deleted.');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể xóa bài tập.');
    }
  };

  const toggleSubmissionsPanel = async (assignmentId: string) => {
    if (expandedAssignmentId === assignmentId) {
      setExpandedAssignmentId(null);
      return;
    }
    setExpandedAssignmentId(assignmentId);
    setActionError('');
    try {
      const list = await api.getAssignmentSubmissions(courseId, assignmentId);
      setSubmissionsByAssignment((current) => ({ ...current, [assignmentId]: list }));
      setGradeDrafts((current) => {
        const next = { ...current };
        for (const sub of list) {
          next[sub.id] = {
            score: sub.score !== null ? String(sub.score) : '',
            feedback: sub.feedback ?? '',
          };
        }
        return next;
      });
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể tải danh sách bài nộp.');
    }
  };

  const saveGrade = async (assignment: Assignment, submission: AssignmentSubmissionRecord) => {
    const draft = gradeDrafts[submission.id] ?? { score: '', feedback: '' };
    const numericScore = Number(draft.score);
    if (draft.score === '' || Number.isNaN(numericScore) || numericScore < 0 || numericScore > assignment.maxScore) {
      setActionError(isVi ? `Điểm phải từ 0 đến ${assignment.maxScore}.` : `Score must be between 0 and ${assignment.maxScore}.`);
      return;
    }
    setBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      const graded = await api.gradeSubmission(courseId, assignment.id, submission.id, {
        score: numericScore,
        feedback: draft.feedback.trim() || null,
      });
      setSubmissionsByAssignment((current) => ({
        ...current,
        [assignment.id]: (current[assignment.id] ?? []).map((item) => (item.id === graded.id ? graded : item)),
      }));
      setActionMessage(isVi ? `Đã chấm điểm cho ${submission.studentName}.` : `Graded submission for ${submission.studentName}.`);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể lưu điểm.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (assignment: Assignment) => {
    const text = (submissionText[assignment.id] ?? assignment.submissionText ?? '').trim();
    if (!text) {
      setActionError(isVi ? 'Vui lòng nhập nội dung bài nộp.' : 'Enter your submission before sending.');
      return;
    }
    setBusy(true);
    setActionError('');
    setActionMessage('');
    try {
      const updated = await api.submitAssignment(courseId, assignment.id, { text });
      setAssignments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setActionMessage(isVi ? 'Đã nộp bài thành công.' : 'Submission sent.');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể nộp bài.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <AppHeader />
      <main className="container assignments-page">
        <Link className="quiz-back" to={isTeacher ? `/teacher/courses/${courseId}/content` : `/courses/${courseId}/content`}>
          {isVi ? '← Quay lại nội dung môn học' : '← Back to course content'}
        </Link>
        <div className="assignments-heading">
          <div>
            <span className="profile-kicker">{courseId}</span>
            <h1>{isVi ? (isTeacher ? 'Quản lý bài tập' : 'Bài tập và hạn nộp') : (isTeacher ? 'Manage assignments' : 'Assignments and deadlines')}</h1>
          </div>
          <span className="assignment-count"><ClipboardList size={15} />{assignments.length}</span>
        </div>

        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {actionMessage && <p className="admin-success" role="status">{actionMessage}</p>}
        {error && <p className="form-error" role="alert">{error.message}</p>}
        {loading && <p className="muted">{isVi ? 'Đang tải bài tập...' : 'Loading assignments...'}</p>}

        {isTeacher && (
          <form className="assignment-create-card" onSubmit={saveAssignment}>
            <h2>{editingAssignment ? (isVi ? 'Chỉnh sửa bài tập' : 'Edit assignment') : (isVi ? 'Tạo bài tập' : 'Create assignment')}</h2>
            <label>
              {isVi ? 'Tên bài tập' : 'Title'}
              <input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              {isVi ? 'Mô tả' : 'Description'}
              <textarea required maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </label>
            <div className="assignment-create-fields">
              <label>
                {isVi ? 'Hạn nộp' : 'Due date'}
                <input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
              </label>
              <label>
                {isVi ? 'Thang điểm' : 'Maximum score'}
                <input required type="number" min="0.5" max="1000" step="0.5" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <button className="btn btn-primary" type="submit" disabled={busy || !title.trim() || !description.trim() || !dueAt}>
                  {editingAssignment ? (isVi ? 'Cập nhật' : 'Save') : (isVi ? 'Lưu bản nháp' : 'Save draft')}
                </button>
                {editingAssignment && (
                  <button className="btn btn-outline" type="button" onClick={resetForm}>
                    {isVi ? 'Hủy' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        <div className="assignment-list">
          {assignments.map((assignment) => {
            const isGraded = assignment.submissionStatus === 'graded';
            const isSubmitted = assignment.submissionStatus === 'submitted' || assignment.submissionStatus === 'late' || isGraded;
            const canSubmit = !isTeacher && assignment.status === 'published' && !isGraded;
            const submissions = submissionsByAssignment[assignment.id] ?? [];
            const isExpanded = expandedAssignmentId === assignment.id;

            return (
              <article className="assignment-card" key={assignment.id}>
                <div className="assignment-card-head">
                  <div>
                    <span className={`assignment-status ${assignment.status}`}>
                      {isTeacher
                        ? (isVi ? { draft: 'Bản nháp', published: 'Đã giao', closed: 'Đã đóng' }[assignment.status] : assignment.status)
                        : (isVi ? { not_submitted: 'Chưa nộp', submitted: 'Đã nộp', graded: 'Đã chấm', late: 'Nộp trễ' }[assignment.submissionStatus ?? 'not_submitted'] : assignment.submissionStatus ?? 'not_submitted')}
                    </span>
                    <h2>{assignment.title}</h2>
                  </div>
                  <strong>{assignment.maxScore} {isVi ? 'điểm' : 'pts'}</strong>
                </div>
                <p className="assignment-description">{assignment.description}</p>
                <div className="assignment-due">
                  <Clock3 size={14} />{isVi ? 'Hạn nộp' : 'Due'}: {formatDueDate(assignment.dueAt, language)}
                  {isTeacher && assignment.submissionCount !== undefined && (
                    <span style={{ marginLeft: 12 }}>
                      · {assignment.submissionCount} {isVi ? 'bài nộp' : 'submissions'} ({assignment.gradedCount ?? 0} {isVi ? 'đã chấm' : 'graded'})
                    </span>
                  )}
                </div>

                {isTeacher ? (
                  <>
                    <div className="assignment-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {assignment.status === 'draft' && (
                        <button className="btn btn-primary" type="button" onClick={() => void updateStatus(assignment, 'published')}>
                          {isVi ? 'Giao bài' : 'Publish'}
                        </button>
                      )}
                      {assignment.status === 'published' && (
                        <button className="btn btn-outline" type="button" onClick={() => void updateStatus(assignment, 'closed')}>
                          {isVi ? 'Đóng nhận bài' : 'Close submissions'}
                        </button>
                      )}
                      {assignment.status === 'closed' && (
                        <button className="btn btn-outline" type="button" onClick={() => void updateStatus(assignment, 'published')}>
                          {isVi ? 'Mở lại' : 'Reopen'}
                        </button>
                      )}
                      <button className="btn btn-outline" type="button" onClick={() => void toggleSubmissionsPanel(assignment.id)}>
                        {isExpanded ? (isVi ? 'Ẩn bài nộp' : 'Hide submissions') : (isVi ? 'Xem & Chấm bài nộp' : 'Review & Grade')}
                      </button>
                      <button className="btn btn-outline" type="button" onClick={() => startEdit(assignment)}>
                        {isVi ? 'Chỉnh sửa' : 'Edit'}
                      </button>
                      <button className="btn btn-danger sm" type="button" onClick={() => void removeAssignment(assignment)}>
                        {isVi ? 'Xóa' : 'Delete'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border, #e2e8f0)' }}>
                        <h3 style={{ fontSize: 15, marginBottom: 10 }}>
                          {isVi ? 'Danh sách bài nộp của học viên' : 'Student submissions'} ({submissions.length})
                        </h3>
                        {submissions.length === 0 ? (
                          <p className="muted">{isVi ? 'Chưa có học viên nào nộp bài.' : 'No submissions yet.'}</p>
                        ) : (
                          <div style={{ display: 'grid', gap: 12 }}>
                            {submissions.map((sub) => {
                              const draft = gradeDrafts[sub.id] ?? { score: sub.score !== null ? String(sub.score) : '', feedback: sub.feedback ?? '' };
                              return (
                                <div
                                  key={sub.id}
                                  style={{
                                    padding: 12,
                                    borderRadius: 8,
                                    background: 'var(--surface-muted, #f8fafc)',
                                    border: '1px solid var(--border, #e2e8f0)',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <strong>{sub.studentName} ({sub.studentId})</strong>
                                    <span className="muted-s">
                                      {formatDueDate(sub.submittedAt, language)} · {sub.status === 'graded' ? (isVi ? `Đã chấm: ${sub.score}/${assignment.maxScore}` : `Graded: ${sub.score}/${assignment.maxScore}`) : (isVi ? 'Chờ chấm' : 'Pending')}
                                    </span>
                                  </div>
                                  <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 10px' }}>{sub.text}</p>
                                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 8, alignItems: 'center' }}>
                                    <input
                                      type="number"
                                      min="0"
                                      max={assignment.maxScore}
                                      step="0.5"
                                      placeholder={isVi ? 'Điểm' : 'Score'}
                                      value={draft.score}
                                      onChange={(e) =>
                                        setGradeDrafts((curr) => ({
                                          ...curr,
                                          [sub.id]: { ...draft, score: e.target.value },
                                        }))
                                      }
                                    />
                                    <input
                                      placeholder={isVi ? 'Nhận xét của giảng viên...' : 'Feedback...'}
                                      value={draft.feedback}
                                      onChange={(e) =>
                                        setGradeDrafts((curr) => ({
                                          ...curr,
                                          [sub.id]: { ...draft, feedback: e.target.value },
                                        }))
                                      }
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-primary sm"
                                      disabled={busy}
                                      onClick={() => void saveGrade(assignment, sub)}
                                    >
                                      {isVi ? 'Lưu điểm' : 'Save grade'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {assignment.submissionStatus === 'graded' && (
                      <div className="assignment-feedback">
                        <strong>{isVi ? 'Điểm' : 'Score'}: {assignment.score ?? '—'}/{assignment.maxScore}</strong>
                        {assignment.feedback && <p>{assignment.feedback}</p>}
                      </div>
                    )}
                    {isSubmitted && assignment.submissionText && (
                      <div className="assignment-feedback" style={{ marginTop: 8 }}>
                        <strong>{isVi ? 'Bài đã nộp' : 'Your submission'}:</strong>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{assignment.submissionText}</p>
                      </div>
                    )}
                    {canSubmit && (
                      <div className="assignment-submit">
                        <label>
                          {isSubmitted ? (isVi ? 'Cập nhật bài nộp' : 'Update submission') : (isVi ? 'Nội dung bài nộp' : 'Submission')}
                          <textarea
                            rows={3}
                            value={submissionText[assignment.id] ?? assignment.submissionText ?? ''}
                            onChange={(event) => setSubmissionText((current) => ({ ...current, [assignment.id]: event.target.value }))}
                            placeholder={isVi ? 'Nhập câu trả lời hoặc liên kết bài làm...' : 'Enter your answer or a link to your work...'}
                          />
                        </label>
                        <button className="btn btn-primary" disabled={busy} onClick={() => void submit(assignment)}>
                          <Send size={14} />{isSubmitted ? (isVi ? 'Nộp lại' : 'Resubmit') : (isVi ? 'Nộp bài' : 'Submit')}
                        </button>
                      </div>
                    )}
                    {isSubmitted && (
                      <p className="assignment-submitted">
                        {isVi ? 'Đã nộp' : 'Submitted'} · {assignment.submittedAt ? formatDueDate(assignment.submittedAt, language) : ''}
                      </p>
                    )}
                  </>
                )}
              </article>
            );
          })}
          {!loading && !error && !assignments.length && (
            <div className="assignment-empty">{isVi ? 'Chưa có bài tập nào.' : 'No assignments yet.'}</div>
          )}
        </div>
      </main>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { ClipboardList, Clock3, Send } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { useAuth } from '../features/auth/AuthContext';
import { useAsync } from '../features/common/useAsync';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { Assignment, AssignmentStatus } from '../types';

function formatDueDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxScore, setMaxScore] = useState('10');
  const [submissionText, setSubmissionText] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setAssignments(data);
  }, [data]);

  const createAssignment = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      const item = await api.createAssignment(courseId, {
        title: title.trim(),
        description: description.trim(),
        dueAt: new Date(dueAt).toISOString(),
        maxScore: Number(maxScore),
      });
      setAssignments((current) => [item, ...current]);
      setTitle('');
      setDescription('');
      setDueAt('');
      setMaxScore('10');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể tạo bài tập.');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (assignment: Assignment, status: AssignmentStatus) => {
    setActionError('');
    try {
      const updated = await api.updateAssignmentStatus(courseId, assignment.id, status);
      setAssignments((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể cập nhật bài tập.');
    }
  };

  const submit = async (assignment: Assignment) => {
    const text = submissionText[assignment.id]?.trim();
    if (!text) {
      setActionError(isVi ? 'Vui lòng nhập nội dung bài nộp.' : 'Enter your submission before sending.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      const updated = await api.submitAssignment(courseId, assignment.id, { text });
      setAssignments((current) => current.map((item) => item.id === updated.id ? updated : item));
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
        {!isTeacher && <Link className="quiz-back" to={`/courses/${courseId}/content`}>{isVi ? '← Quay lại nội dung môn học' : '← Back to course content'}</Link>}
        <div className="assignments-heading">
          <div>
            <span className="profile-kicker">{courseId}</span>
            <h1>{isVi ? (isTeacher ? 'Quản lý bài tập' : 'Bài tập và hạn nộp') : (isTeacher ? 'Manage assignments' : 'Assignments and deadlines')}</h1>
          </div>
          <span className="assignment-count"><ClipboardList size={15} />{assignments.length}</span>
        </div>

        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {error && <p className="form-error" role="alert">{error.message}</p>}
        {loading && <p className="muted">{isVi ? 'Đang tải bài tập...' : 'Loading assignments...'}</p>}

        {isTeacher && (
          <form className="assignment-create-card" onSubmit={createAssignment}>
            <h2>{isVi ? 'Tạo bài tập' : 'Create assignment'}</h2>
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
              <button className="btn btn-primary" type="submit" disabled={busy || !title.trim() || !description.trim() || !dueAt}>
                {isVi ? 'Lưu bản nháp' : 'Save draft'}
              </button>
            </div>
          </form>
        )}

        <div className="assignment-list">
          {assignments.map((assignment) => {
            const isSubmitted = assignment.submissionStatus === 'submitted' || assignment.submissionStatus === 'graded';
            const canSubmit = !isTeacher && assignment.status === 'published'
              && !isSubmitted && new Date(assignment.dueAt).getTime() >= Date.now();
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
                <div className="assignment-due"><Clock3 size={14} />{isVi ? 'Hạn nộp' : 'Due'}: {formatDueDate(assignment.dueAt, language)}</div>

                {isTeacher ? (
                  <div className="assignment-actions">
                    {assignment.status === 'draft' && (
                      <button className="btn btn-primary" onClick={() => updateStatus(assignment, 'published')}>
                        {isVi ? 'Giao bài' : 'Publish'}
                      </button>
                    )}
                    {assignment.status === 'published' && (
                      <button className="btn btn-outline" onClick={() => updateStatus(assignment, 'closed')}>
                        {isVi ? 'Đóng nhận bài' : 'Close submissions'}
                      </button>
                    )}
                    {assignment.status === 'closed' && (
                      <button className="btn btn-outline" onClick={() => updateStatus(assignment, 'published')}>
                        {isVi ? 'Mở lại' : 'Reopen'}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {assignment.submissionStatus === 'graded' && (
                      <div className="assignment-feedback">
                        <strong>{isVi ? 'Điểm' : 'Score'}: {assignment.score ?? '—'}/{assignment.maxScore}</strong>
                        {assignment.feedback && <p>{assignment.feedback}</p>}
                      </div>
                    )}
                    {canSubmit && (
                      <div className="assignment-submit">
                        <label>
                          {isVi ? 'Nội dung bài nộp' : 'Submission'}
                          <textarea
                            rows={3}
                            value={submissionText[assignment.id] ?? ''}
                            onChange={(event) => setSubmissionText((current) => ({ ...current, [assignment.id]: event.target.value }))}
                            placeholder={isVi ? 'Nhập câu trả lời hoặc liên kết bài làm...' : 'Enter your answer or a link to your work...'}
                          />
                        </label>
                        <button className="btn btn-primary" disabled={busy} onClick={() => submit(assignment)}>
                          <Send size={14} />{isVi ? 'Nộp bài' : 'Submit'}
                        </button>
                      </div>
                    )}
                    {isSubmitted && (
                      <p className="assignment-submitted">{isVi ? 'Đã nộp' : 'Submitted'} · {assignment.submittedAt ? formatDueDate(assignment.submittedAt, language) : ''}</p>
                    )}
                    {!canSubmit && !isSubmitted && assignment.status === 'published' && (
                      <p className="muted">{isVi ? 'Đã hết hạn nộp bài.' : 'The submission deadline has passed.'}</p>
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

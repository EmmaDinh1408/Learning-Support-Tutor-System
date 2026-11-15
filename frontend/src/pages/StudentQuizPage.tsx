import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAsync } from '../features/common/useAsync';
import { AppHeader } from '../features/layout/AppHeader';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { QuizAttempt } from '../types';

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export default function StudentQuizPage() {
  const { courseId = '', quizId = '' } = useParams();
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const { data: quiz, loading, error: loadError } = useAsync(
    () => api.getQuiz(courseId, quizId),
    [courseId, quizId],
  );
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [result, setResult] = useState<QuizAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const autoSubmitted = useRef(false);

  useEffect(() => {
    if (!attempt || result) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, result]);

  const submit = async () => {
    if (!attempt || busy || result) return;
    setBusy(true);
    setActionError('');
    try {
      const submitted = await api.submitQuizAttempt(courseId, quizId, attempt.id, { answers });
      setResult(submitted);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể nộp bài kiểm tra.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (remaining === 0 && attempt && Date.now() >= new Date(attempt.expiresAt).getTime()
      && !result && !busy && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit();
    }
  }, [remaining, attempt, result, busy]);

  const start = async () => {
    setBusy(true);
    setActionError('');
    try {
      const started = await api.startQuizAttempt(courseId, quizId);
      setAttempt(started);
      setRemaining(Math.max(0, Math.ceil((new Date(started.expiresAt).getTime() - Date.now()) / 1000)));
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể bắt đầu bài kiểm tra.');
    } finally {
      setBusy(false);
    }
  };

  const canStart = !!quiz && quiz.status === 'published' && quiz.attemptsUsed < quiz.attemptsAllowed;

  return (
    <div className="page">
      <AppHeader />
      <main className="container quiz-page">
        <Link className="quiz-back" to={`/courses/${courseId}/content`}><ArrowLeft size={15} />{isVi ? 'Quay lại nội dung môn học' : 'Back to course content'}</Link>
        {loading && <p className="muted">{isVi ? 'Đang tải bài kiểm tra...' : 'Loading quiz...'}</p>}
        {loadError && <p className="form-error" role="alert">{loadError.message}</p>}
        {quiz && (
          <>
            <header className="quiz-heading">
              <span className="profile-kicker">{courseId}</span>
              <h1>{quiz.title}</h1>
              <p>{quiz.description}</p>
              <div className="quiz-meta">
                <span><Clock3 size={14} />{quiz.timeLimitMinutes} {isVi ? 'phút' : 'minutes'}</span>
                <span>{quiz.questions.length} {isVi ? 'câu hỏi' : 'questions'}</span>
                <span>{isVi ? 'Số lần làm' : 'Attempts'}: {quiz.attemptsUsed}/{quiz.attemptsAllowed}</span>
              </div>
            </header>

            {actionError && <p className="form-error" role="alert">{actionError}</p>}
            {!attempt && !result && (
              <section className="quiz-start-card">
                <p>{isVi ? 'Thời gian bắt đầu tính ngay khi bạn bắt đầu. Hệ thống sẽ tự nộp khi hết giờ.' : 'The timer starts when you begin. Your answers will be submitted automatically when time runs out.'}</p>
                <button className="btn btn-primary" onClick={start} disabled={busy || !canStart}>
                  {canStart ? (isVi ? 'Bắt đầu làm bài' : 'Start quiz') : (isVi ? 'Không còn lượt làm' : 'No attempts remaining')}
                </button>
              </section>
            )}

            {attempt && !result && (
              <>
                <div className={`quiz-timer ${remaining < 60 ? 'urgent' : ''}`} aria-live="polite">
                  <Clock3 size={16} />{isVi ? 'Thời gian còn lại' : 'Time remaining'} <strong>{formatTime(remaining)}</strong>
                </div>
                <div className="quiz-question-list">
                  {quiz.questions.map((question, index) => (
                    <fieldset className="quiz-question" key={question.id}>
                      <legend>{isVi ? `Câu ${index + 1}` : `Question ${index + 1}`}: {question.prompt}</legend>
                      {question.options.map((option) => (
                        <label className="quiz-option" key={option.id}>
                          <input
                            type="radio"
                            name={question.id}
                            value={option.id}
                            checked={answers[question.id] === option.id}
                            onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                          />
                          <span>{option.text}</span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
                <div className="quiz-submit-row">
                  <span>{Object.keys(answers).length}/{quiz.questions.length} {isVi ? 'câu đã trả lời' : 'answered'}</span>
                  <button className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
                    {isVi ? 'Nộp bài kiểm tra' : 'Submit quiz'}
                  </button>
                </div>
              </>
            )}

            {result && (
              <section className="quiz-result-card">
                <CheckCircle2 size={26} />
                <h2>{isVi ? 'Đã nộp bài' : 'Quiz submitted'}</h2>
                <strong>{result.score?.toLocaleString(isVi ? 'vi-VN' : 'en-US')} / {result.maxScore}</strong>
                <p>{result.correctCount}/{result.totalQuestions} {isVi ? 'câu trả lời đúng' : 'correct answers'}</p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

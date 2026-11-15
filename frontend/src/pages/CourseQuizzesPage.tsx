import { BookOpenCheck, CirclePlus, Clock3, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { useAsync } from '../features/common/useAsync';
import { AppHeader } from '../features/layout/AppHeader';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { CreateQuizQuestionInput, Quiz, QuizStatus } from '../types';

function emptyQuestion(index: number): CreateQuizQuestionInput {
  const id = `question-${index}-${Date.now()}`;
  const options = ['A', 'B', 'C', 'D'].map((letter) => ({ id: `${id}-${letter.toLowerCase()}`, text: '' }));
  return { id, prompt: '', options, correctOptionId: options[0].id };
}

export default function CourseQuizzesPage() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const isTeacher = user?.role === 'teacher';
  const { data, loading, error } = useAsync(
    () => api.getQuizzes(courseId, isTeacher ? 'teacher' : 'student'),
    [courseId, isTeacher],
  );
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState('10');
  const [attemptsAllowed, setAttemptsAllowed] = useState('2');
  const [questions, setQuestions] = useState<CreateQuizQuestionInput[]>([emptyQuestion(1)]);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setQuizzes(data);
  }, [data]);

  const updateQuestion = (questionId: string, update: Partial<CreateQuizQuestionInput>) => {
    setQuestions((current) => current.map((question) => question.id === questionId ? { ...question, ...update } : question));
  };

  const updateOption = (questionId: string, optionId: string, text: string) => {
    setQuestions((current) => current.map((question) => question.id === questionId
      ? { ...question, options: question.options.map((option) => option.id === optionId ? { ...option, text } : option) }
      : question));
  };

  const createQuiz = async (event: FormEvent) => {
    event.preventDefault();
    if (questions.some((question) => !question.prompt.trim() || question.options.some((option) => !option.text.trim()))) {
      setActionError(isVi ? 'Vui lòng nhập nội dung và đủ bốn lựa chọn cho mỗi câu hỏi.' : 'Enter a prompt and all four options for every question.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      const quiz = await api.createQuiz(courseId, {
        title: title.trim(),
        description: description.trim(),
        timeLimitMinutes: Number(timeLimit),
        attemptsAllowed: Number(attemptsAllowed),
        questions,
      });
      setQuizzes((current) => [quiz, ...current]);
      setTitle('');
      setDescription('');
      setQuestions([emptyQuestion(1)]);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : (isVi ? 'Không thể tạo quiz.' : 'Unable to create quiz.'));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (quiz: Quiz, status: QuizStatus) => {
    setBusy(true);
    setActionError('');
    try {
      const updated = await api.updateQuizStatus(courseId, quiz.id, status);
      setQuizzes((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : (isVi ? 'Không thể cập nhật quiz.' : 'Unable to update quiz.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <AppHeader />
      <main className="container course-quizzes-page">
        {!isTeacher && <Link className="quiz-back" to={`/courses/${courseId}/content`}>{isVi ? '← Quay lại nội dung môn học' : '← Back to course content'}</Link>}
        <div className="assignments-heading">
          <div>
            <span className="profile-kicker">{courseId}</span>
            <h1>{isVi ? (isTeacher ? 'Quản lý quiz' : 'Quiz và bài kiểm tra') : (isTeacher ? 'Manage quizzes' : 'Quizzes and tests')}</h1>
          </div>
          <span className="assignment-count"><BookOpenCheck size={15} />{quizzes.length}</span>
        </div>

        {error && <p className="form-error" role="alert">{error.message}</p>}
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {loading && <p className="muted">{isVi ? 'Đang tải quiz...' : 'Loading quizzes...'}</p>}

        {isTeacher && (
          <form className="quiz-author-card" onSubmit={createQuiz}>
            <h2>{isVi ? 'Tạo quiz trắc nghiệm' : 'Create a multiple-choice quiz'}</h2>
            <label>{isVi ? 'Tiêu đề' : 'Title'}<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>{isVi ? 'Mô tả' : 'Description'}<textarea maxLength={2000} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <div className="quiz-author-settings">
              <label>{isVi ? 'Thời gian (phút)' : 'Time limit (minutes)'}<input type="number" min="1" max="300" required value={timeLimit} onChange={(event) => setTimeLimit(event.target.value)} /></label>
              <label>{isVi ? 'Số lần làm tối đa' : 'Allowed attempts'}<input type="number" min="1" max="20" required value={attemptsAllowed} onChange={(event) => setAttemptsAllowed(event.target.value)} /></label>
            </div>

            <div className="quiz-author-questions">
              {questions.map((question, questionIndex) => (
                <fieldset className="quiz-author-question" key={question.id}>
                  <legend>
                    <span>{isVi ? `Câu ${questionIndex + 1}` : `Question ${questionIndex + 1}`}</span>
                    {questions.length > 1 && (
                      <button type="button" className="icon-plain" aria-label={isVi ? 'Xóa câu hỏi' : 'Remove question'}
                        onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </legend>
                  <label>{isVi ? 'Nội dung câu hỏi' : 'Question prompt'}<textarea required maxLength={1000} rows={2} value={question.prompt}
                    onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })} /></label>
                  <div className="quiz-author-options">
                    {question.options.map((option, optionIndex) => (
                      <label className="quiz-author-option" key={option.id}>
                        <input type="radio" name={`correct-${question.id}`} checked={question.correctOptionId === option.id}
                          onChange={() => updateQuestion(question.id, { correctOptionId: option.id })}
                          aria-label={isVi ? `Chọn lựa chọn ${optionIndex + 1} là đáp án đúng` : `Mark option ${optionIndex + 1} as correct`} />
                        <span>{String.fromCharCode(65 + optionIndex)}</span>
                        <input required maxLength={400} value={option.text}
                          aria-label={isVi ? `Nội dung lựa chọn ${optionIndex + 1}` : `Option ${optionIndex + 1} text`}
                          onChange={(event) => updateOption(question.id, option.id, event.target.value)} />
                      </label>
                    ))}
                  </div>
                  <p className="muted">{isVi ? 'Chọn nút tròn để đặt đáp án đúng. Đáp án không được gửi tới học viên.' : 'Select the radio button for the correct answer. Answer keys are never sent to students.'}</p>
                </fieldset>
              ))}
            </div>
            <div className="quiz-author-actions">
              <button type="button" className="btn btn-outline" onClick={() => setQuestions((current) => [...current, emptyQuestion(current.length + 1)])}>
                <CirclePlus size={14} />{isVi ? 'Thêm câu hỏi' : 'Add question'}
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>
                {busy ? (isVi ? 'Đang lưu...' : 'Saving...') : (isVi ? 'Lưu bản nháp' : 'Save draft')}
              </button>
            </div>
          </form>
        )}

        <section className="quiz-list">
          {quizzes.map((quiz) => (
            <article className="quiz-list-card" key={quiz.id}>
              <div>
                <span className={`assignment-status ${quiz.status}`}>{isVi
                  ? { draft: 'Bản nháp', published: 'Đã xuất bản', closed: 'Đã đóng' }[quiz.status]
                  : quiz.status}</span>
                <h2>{quiz.title}</h2>
                {quiz.description && <p>{quiz.description}</p>}
                <div className="quiz-meta">
                  <span><Clock3 size={14} />{quiz.timeLimitMinutes} {isVi ? 'phút' : 'minutes'}</span>
                  <span>{quiz.questions.length} {isVi ? 'câu hỏi' : 'questions'}</span>
                  <span>{quiz.attemptsUsed}/{quiz.attemptsAllowed} {isVi ? 'lần làm' : 'attempts'}</span>
                </div>
              </div>
              {isTeacher ? (
                <div className="quiz-list-actions">
                  {quiz.status === 'draft' && <button className="btn btn-primary" disabled={busy} onClick={() => setStatus(quiz, 'published')}>{isVi ? 'Xuất bản' : 'Publish'}</button>}
                  {quiz.status === 'published' && <button className="btn btn-outline" disabled={busy} onClick={() => setStatus(quiz, 'closed')}>{isVi ? 'Đóng quiz' : 'Close quiz'}</button>}
                  {quiz.status === 'closed' && <button className="btn btn-outline" disabled={busy} onClick={() => setStatus(quiz, 'published')}>{isVi ? 'Mở lại' : 'Reopen'}</button>}
                </div>
              ) : (
                <button className="btn btn-primary" onClick={() => navigate(`/courses/${courseId}/quizzes/${quiz.id}`)}>
                  {isVi ? 'Vào làm bài' : 'Start quiz'}
                </button>
              )}
            </article>
          ))}
          {!loading && !error && !quizzes.length && <p className="course-empty-section">{isVi ? 'Chưa có quiz nào.' : 'No quizzes yet.'}</p>}
        </section>
      </main>
    </div>
  );
}

import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  GitBranch,
  Layers,
  Lock,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type {
  ChapterLessonItem,
  ChapterWorkflowState,
  CourseOutlineData,
  CourseRelationItem,
  OutlineState,
  ReviewDecision,
  WorkflowJobResponse,
} from '../../types';

interface Props {
  courseId: string;
  courseName: string;
  onPublishedGraph: () => void;
}

type Step = 1 | 2 | 3 | 4;

function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const CHAPTER_STATE_LABEL: Record<ChapterWorkflowState, { text: string; tone: string }> = {
  DRAFT: { text: 'Bản nháp', tone: 'muted' },
  LESSON_REVIEW: { text: 'Chờ duyệt bài học', tone: 'amber' },
  LESSON_APPROVED: { text: 'Đã duyệt chương', tone: 'green' },
  PUBLISHED: { text: 'Đã xuất bản', tone: 'blue' },
};

const OUTLINE_STATE_LABEL: Record<OutlineState, { text: string; tone: string }> = {
  DRAFT: { text: 'Bản nháp', tone: 'muted' },
  OUTLINE_REVIEW: { text: 'Đang kiểm tra khung', tone: 'amber' },
  OUTLINE_APPROVED: { text: 'Đã duyệt khung (OUTLINE_APPROVED)', tone: 'green' },
};

const DECISION_BADGE: Record<ReviewDecision, { text: string; color: string }> = {
  PENDING: { text: 'Chờ quyết định', color: '#b45309' },
  APPROVE: { text: 'Đã duyệt', color: '#15803d' },
  EDIT: { text: 'Đã chỉnh sửa', color: '#1d4ed8' },
  REJECT: { text: 'Đã từ chối', color: '#b91c1c' },
};

export function CourseAuthoringWizard({ courseId, courseName, onPublishedGraph }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // D1 Outline state
  const [outline, setOutline] = useState<CourseOutlineData>({ chapters: [], learningOutcomes: [] });
  const [outlineState, setOutlineState] = useState<OutlineState>('DRAFT');
  const [outlineRevision, setOutlineRevision] = useState(1);
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);

  // D2 Chapter lessons state
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [chapterFile, setChapterFile] = useState<File | null>(null);
  const [lessons, setLessons] = useState<ChapterLessonItem[]>([]);
  const [lessonsCursor, setLessonsCursor] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // D3 Relations state
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [relations, setRelations] = useState<CourseRelationItem[]>([]);
  const [relationsCursor, setRelationsCursor] = useState<string | null>(null);
  const [relationRevision, setRelationRevision] = useState(1);

  // D4 Publish state
  const [masterVersion, setMasterVersion] = useState(0);
  const [pendingPublicationId, setPendingPublicationId] = useState<string | null>(null);
  const [publishWarnings, setPublishWarnings] = useState<string[]>([]);

  // D5 Active Job state
  const [activeJob, setActiveJob] = useState<(WorkflowJobResponse & { kind: 'outline' | 'lesson' | 'relation' }) | null>(null);

  const loadOutline = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getOutlineDraft(courseId);
      setOutline(res.outline);
      setOutlineState(res.state);
      setOutlineRevision(res.revision);
      if (res.outline.chapters.length && !selectedChapterId) {
        setSelectedChapterId(res.outline.chapters[0].id);
      }
      const approvedIds = res.outline.chapters
        .filter((c) => c.state === 'LESSON_APPROVED' || c.state === 'PUBLISHED')
        .map((c) => c.id);
      setSelectedChapterIds(approvedIds);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải khung môn học.');
    } finally {
      setLoading(false);
    }
  }, [courseId, selectedChapterId]);

  const loadChapterLessons = useCallback(
    async (cid: string, append = false, cursor?: string | null) => {
      if (!cid) return;
      try {
        const res = await api.getChapterLessons(courseId, cid, cursor, 20);
        setLessons((prev) => (append ? [...prev, ...res.items] : res.items));
        setLessonsCursor(res.nextCursor);
        setOutline((prev) => ({
          ...prev,
          chapters: prev.chapters.map((c) => (c.id === cid ? { ...c, revision: res.revision } : c)),
        }));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Không thể tải bài học chương.');
      }
    },
    [courseId],
  );

  const loadRelations = useCallback(
    async (append = false, cursor?: string | null) => {
      try {
        const res = await api.getCourseRelations(courseId, cursor, 20);
        setRelations((prev) => (append ? [...prev, ...res.items] : res.items));
        setRelationsCursor(res.nextCursor);
        setRelationRevision(res.revision);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách quan hệ.');
      }
    },
    [courseId],
  );

  useEffect(() => {
    void loadOutline();
  }, [courseId]);

  useEffect(() => {
    if (step === 2 && selectedChapterId) {
      void loadChapterLessons(selectedChapterId);
    }
    if (step === 3) {
      void loadRelations();
    }
  }, [step, selectedChapterId, loadChapterLessons, loadRelations]);

  // D5 Job Polling
  useEffect(() => {
    if (!activeJob?.jobId) return;
    if (activeJob.status === 'SUCCEEDED' || activeJob.status === 'BLOCKED' || activeJob.status === 'FAILED') {
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const latest = await api.getWorkflowJob(activeJob.jobId!);
        setActiveJob((prev) => (prev ? { ...latest, jobId: prev.jobId, kind: prev.kind } : null));
        if (latest.status === 'SUCCEEDED') {
          if (activeJob.kind === 'outline') {
            setMessage('AI đã trích xuất xong Khung môn học (Chương & Chuẩn đầu ra). Hãy rà soát và duyệt.');
            await loadOutline();
          } else if (activeJob.kind === 'lesson' && selectedChapterId) {
            setMessage('AI đã sinh & kiểm tra xong bài học cho chương. Hãy duyệt từng bài học.');
            await loadOutline();
            await loadChapterLessons(selectedChapterId);
          } else if (activeJob.kind === 'relation') {
            setMessage('AI đã sinh xong quan hệ liên chương. Hãy kiểm duyệt trước khi xuất bản.');
            await loadRelations();
          }
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Lỗi khi theo dõi tiến độ job.');
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeJob, loadOutline, loadChapterLessons, loadRelations, selectedChapterId]);

  const handleResumeJob = async () => {
    if (!activeJob?.jobId) return;
    setError('');
    try {
      const res = await api.resumeWorkflowJob(activeJob.jobId, newIdempotencyKey('resume'));
      setActiveJob((prev) => (prev ? { ...prev, status: res.status } : null));
      setMessage('Đã xếp lại job từ checkpoint gần nhất.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tiếp tục job.');
    }
  };

  /* -------------------- D1 Handlers -------------------- */
  const handleRunOutlineJob = async () => {
    if (!syllabusFile) {
      setError('Vui lòng chọn tệp đề cương PDF trước.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { syllabusId } = await api.uploadCourseSyllabus(courseId, syllabusFile);
      const { jobId, status } = await api.createOutlineJob(courseId, syllabusId, newIdempotencyKey('outline'));
      setActiveJob({
        kind: 'outline',
        jobId,
        status: (status as WorkflowJobResponse['status']) ?? 'QUEUED',
        progress: 10,
        canResume: true,
        resumeCount: 0,
        maxResumeAttempts: 3,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tạo job trích xuất khung môn học.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveOutlineDraft = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await api.saveOutlineDraft(courseId, outline, outlineRevision);
      setOutline(saved.outline);
      setOutlineState(saved.state);
      setOutlineRevision(saved.revision);
      setMessage(`Đã lưu bản nháp khung môn học (Revision ${saved.revision}).`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu bản nháp.');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveOutline = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      // Save latest edits first if needed, then approve
      const saved = await api.saveOutlineDraft(courseId, outline, outlineRevision);
      const approved = await api.approveOutline(courseId, saved.revision);
      setOutlineState(approved.state);
      setOutlineRevision(approved.revision);
      setMessage('Đã duyệt Khung môn học (OUTLINE_APPROVED). Bây giờ bạn có thể nạp tài liệu từng chương ở Bước 2.');
      if (saved.outline.chapters.length && !selectedChapterId) {
        setSelectedChapterId(saved.outline.chapters[0].id);
      }
      setStep(2);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể duyệt khung môn học.');
    } finally {
      setBusy(false);
    }
  };

  /* -------------------- D2 Handlers -------------------- */
  const currentChapter = outline.chapters.find((c) => c.id === selectedChapterId);

  const handleUploadChapterDoc = async () => {
    if (!currentChapter || !chapterFile) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.uploadChapterDocument(courseId, currentChapter.id, chapterFile);
      setChapterFile(null);
      setMessage(`Đã tải tài liệu lên ${currentChapter.title} (Revision ${res.revision}).`);
      await loadOutline();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải tài liệu chương.');
    } finally {
      setBusy(false);
    }
  };

  const handleRunLessonJob = async () => {
    if (!currentChapter) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { jobId, status } = await api.createLessonJob(
        courseId,
        currentChapter.id,
        currentChapter.revision,
        newIdempotencyKey('lesson'),
      );
      setActiveJob({
        kind: 'lesson',
        jobId,
        status: (status as WorkflowJobResponse['status']) ?? 'QUEUED',
        progress: 15,
        canResume: true,
        resumeCount: 0,
        maxResumeAttempts: 3,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể khởi chạy Lesson Job.');
    } finally {
      setBusy(false);
    }
  };

  const handleReopenChapter = async () => {
    if (!currentChapter) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.reopenChapter(courseId, currentChapter.id, currentChapter.revision);
      setMessage(`Đã mở lại chương ${currentChapter.title} về trạng thái ${res.state}.`);
      await loadOutline();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể mở lại chương.');
    } finally {
      setBusy(false);
    }
  };

  const handleLessonDecision = async (lessonId: string, decision: ReviewDecision, changes?: Partial<ChapterLessonItem>) => {
    if (!currentChapter) return;
    setError('');
    try {
      const res = await api.reviewChapterLesson(courseId, currentChapter.id, lessonId, {
        decision,
        changes,
        expectedRevision: currentChapter.revision,
      });
      setLessons((prev) => prev.map((l) => (l.id === lessonId ? res.lesson : l)));
      setOutline((prev) => ({
        ...prev,
        chapters: prev.chapters.map((c) => (c.id === currentChapter.id ? { ...c, revision: res.revision } : c)),
      }));
      setEditingLessonId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật quyết định bài học.');
    }
  };

  const handleBatchApproveLessons = async () => {
    if (!currentChapter || !lessons.length) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.batchReviewChapterLessons(courseId, currentChapter.id, {
        items: lessons.map((l) => ({
          lessonId: l.id,
          decision: l.decision === 'REJECT' ? 'REJECT' : 'APPROVE',
        })),
        expectedRevision: currentChapter.revision,
      });
      setMessage(`Đã duyệt hàng loạt ${res.updatedCount} bài học.`);
      await loadChapterLessons(currentChapter.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể duyệt hàng loạt.');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveChapter = async () => {
    if (!currentChapter) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.approveChapterLessons(courseId, currentChapter.id, currentChapter.revision);
      setMessage(`Chương "${currentChapter.title}" đã được duyệt (${res.state}).`);
      await loadOutline();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể duyệt chương.');
    } finally {
      setBusy(false);
    }
  };

  const handleDiscardChapterDraft = async () => {
    if (!currentChapter || !window.confirm('Hủy toàn bộ bản nháp bài học của chương này? (Tài liệu PDF đã tải vẫn được giữ)')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.discardChapterLessons(courseId, currentChapter.id, currentChapter.revision);
      setLessons([]);
      setMessage('Đã hủy bản nháp bài học của chương.');
      await loadOutline();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể hủy bản nháp.');
    } finally {
      setBusy(false);
    }
  };

  /* -------------------- D3 Handlers -------------------- */
  const approvedChapters = outline.chapters.filter(
    (c) => c.state === 'LESSON_APPROVED' || c.state === 'PUBLISHED',
  );

  const handleRunRelationJob = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { jobId, status } = await api.createRelationJob(
        courseId,
        selectedChapterIds,
        relationRevision,
        newIdempotencyKey('relation'),
      );
      setActiveJob({
        kind: 'relation',
        jobId,
        status: (status as WorkflowJobResponse['status']) ?? 'QUEUED',
        progress: 20,
        canResume: true,
        resumeCount: 0,
        maxResumeAttempts: 3,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể khởi chạy Relation Job.');
    } finally {
      setBusy(false);
    }
  };

  const handleRelationDecision = async (relationId: string, decision: ReviewDecision) => {
    setError('');
    try {
      const res = await api.reviewCourseRelation(courseId, relationId, {
        decision,
        expectedRevision: relationRevision,
      });
      setRelations((prev) => prev.map((r) => (r.id === relationId ? res.relation : r)));
      setRelationRevision(res.revision);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật quyết định quan hệ.');
    }
  };

  const handleBatchApproveRelations = async () => {
    if (!relations.length) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.batchReviewCourseRelations(courseId, {
        items: relations.map((r) => ({ relationId: r.id, decision: r.decision === 'REJECT' ? 'REJECT' : 'APPROVE' })),
        expectedRevision: relationRevision,
      });
      setRelationRevision(res.revision);
      setMessage(`Đã duyệt hàng loạt ${res.updatedCount} quan hệ liên chương.`);
      await loadRelations();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể duyệt hàng loạt quan hệ.');
    } finally {
      setBusy(false);
    }
  };

  const handleDiscardRelations = async () => {
    if (!window.confirm('Xác nhận hủy bản nháp quan hệ liên chương?')) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.discardCourseRelations(courseId, relationRevision);
      setRelationRevision(res.revision);
      setRelations([]);
      setMessage('Đã hủy bản nháp quan hệ liên chương.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể hủy bản nháp quan hệ.');
    } finally {
      setBusy(false);
    }
  };

  /* -------------------- D4 Handlers -------------------- */
  const handlePublish = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.publishCourseGraph(
        courseId,
        relationRevision,
        masterVersion,
        newIdempotencyKey('publish'),
      );
      setMasterVersion(res.masterVersion);
      setRelationRevision(res.revision);
      setPublishWarnings(res.warnings ?? []);
      setPendingPublicationId(null);
      setMessage(`Xuất bản Master Graph v${res.masterVersion} thành công!`);
      await loadOutline();
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : 'Không thể xuất bản Master Graph.';
      setError(msg);
      if (msg.includes('503')) {
        setPendingPublicationId(`pub-${courseId}-${Date.now()}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRecoverPublish = async () => {
    if (!pendingPublicationId) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.recoverCoursePublish(courseId, pendingPublicationId);
      setMasterVersion(res.masterVersion);
      setRelationRevision(res.revision);
      setPendingPublicationId(null);
      setMessage(`Đã phục hồi và chốt xuất bản Master Graph v${res.masterVersion}!`);
      await loadOutline();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chưa thể phục hồi xuất bản.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="wizard-shell" style={{ display: 'grid', placeItems: 'center', minHeight: 360 }}>
        Đang tải quy trình dựng đồ thị môn học…
      </div>
    );
  }

  return (
    <div className="wizard-shell">
      {/* Stepper Header */}
      <div className="wizard-stepper">
        {[
          { num: 1 as Step, title: 'D1. Khung môn học', sub: outlineState === 'OUTLINE_APPROVED' ? 'Đã duyệt' : 'Đề cương & LO', locked: false },
          { num: 2 as Step, title: 'D2. Bài học theo chương', sub: `${approvedChapters.length}/${outline.chapters.length} chương duyệt`, locked: outlineState !== 'OUTLINE_APPROVED' },
          { num: 3 as Step, title: 'D3. Quan hệ liên chương', sub: `${relations.filter((r) => r.decision !== 'PENDING').length}/${relations.length} cạnh`, locked: outlineState !== 'OUTLINE_APPROVED' },
          { num: 4 as Step, title: 'D4. Xuất bản Master Graph', sub: masterVersion > 0 ? `v${masterVersion}` : 'Chưa xuất bản', locked: outlineState !== 'OUTLINE_APPROVED' },
        ].map((item, idx) => (
          <div key={item.num} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <button
              type="button"
              disabled={item.locked}
              onClick={() => setStep(item.num)}
              className={`wizard-step-btn${step === item.num ? ' active' : ''}${item.locked ? ' locked' : ''}`}
            >
              <span className="wizard-step-num">{item.locked ? <Lock size={12} /> : item.num}</span>
              <span className="wizard-step-meta">
                <b>{item.title}</b>
                <small>{item.sub}</small>
              </span>
            </button>
            {idx < 3 && <ChevronRight size={16} className="muted-icon" />}
          </div>
        ))}
      </div>

      {/* Banners */}
      {error && (
        <div className="wizard-banner error" role="alert">
          <AlertTriangle size={15} /> <span>{error}</span>
          <button type="button" onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}
      {message && (
        <div className="wizard-banner success" role="status">
          <CheckCircle2 size={15} /> <span>{message}</span>
          <button type="button" onClick={() => setMessage('')}><X size={14} /></button>
        </div>
      )}

      {/* D5 Active Job Tracker */}
      {activeJob && (
        <div className="wizard-job-bar">
          <div className="wizard-job-info">
            <Sparkles size={15} />
            <div>
              <b>
                {activeJob.kind === 'outline' && 'Đang trích xuất Khung môn học (D1 → D5)'}
                {activeJob.kind === 'lesson' && 'Đang sinh & đối chiếu bài học chương (D2 → D5)'}
                {activeJob.kind === 'relation' && 'Đang sinh & kiểm tra quan hệ liên chương (D3 → D5)'}
              </b>
              <span>
                Trạng thái: <code>{activeJob.status}</code> · Tiến độ: {activeJob.progress}% · Resume: {activeJob.resumeCount}/{activeJob.maxResumeAttempts}
              </span>
            </div>
          </div>
          <div className="wizard-job-progress">
            <div className="wizard-job-fill" style={{ width: `${activeJob.progress}%` }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(activeJob.status === 'BLOCKED' || activeJob.status === 'FAILED') && activeJob.canResume && (
              <button type="button" className="btn btn-primary" onClick={handleResumeJob}>
                <RefreshCw size={12} /> Resume từ checkpoint
              </button>
            )}
            {(activeJob.status === 'SUCCEEDED' || activeJob.status === 'FAILED') && (
              <button type="button" className="btn btn-outline" onClick={() => setActiveJob(null)}>Đóng</button>
            )}
          </div>
        </div>
      )}

      {/* STEP 1: D1 OUTLINE */}
      {step === 1 && (
        <div className="wizard-panel">
          <div className="wizard-panel-head">
            <div>
              <h3>D1. Khung môn học — {courseName}</h3>
              <p className="muted-s">
                Tải đề cương để AI tạo khung Chương & Chuẩn đầu ra (LO). Chỉ sau khi duyệt (<code>OUTLINE_APPROVED</code>) mới được gắn tài liệu chương.
              </p>
            </div>
            <div className="wizard-badges">
              <span className={`pill-badge ${OUTLINE_STATE_LABEL[outlineState].tone}`}>
                {OUTLINE_STATE_LABEL[outlineState].text}
              </span>
              <span className="pill-badge muted">Rev {outlineRevision}</span>
            </div>
          </div>

          <div className="wizard-upload-row">
            <label className="wizard-file-box">
              <Upload size={15} />
              <span>{syllabusFile ? syllabusFile.name : 'Chọn tệp đề cương chi tiết (PDF)...'}</span>
              <input
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => setSyllabusFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button type="button" className="btn btn-primary" disabled={busy || !syllabusFile} onClick={handleRunOutlineJob}>
              <Sparkles size={13} /> Trích xuất khung bằng AI
            </button>
          </div>

          <div className="wizard-grid-2">
            {/* Learning Outcomes */}
            <div className="wizard-card">
              <div className="wizard-card-head">
                <h4>Chuẩn đầu ra (Learning Outcomes)</h4>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setOutline((prev) => ({
                      ...prev,
                      learningOutcomes: [
                        ...prev.learningOutcomes,
                        { code: `L.O.${prev.learningOutcomes.length + 1}`, description: 'Mô tả chuẩn đầu ra mới' },
                      ],
                    }))
                  }
                >
                  <Plus size={12} /> Thêm LO
                </button>
              </div>
              {outline.learningOutcomes.length === 0 ? (
                <p className="muted-s">Chưa có Chuẩn đầu ra. Hãy tải đề cương PDF hoặc bấm "Thêm LO".</p>
              ) : (
                <div className="wizard-list">
                  {outline.learningOutcomes.map((lo, idx) => (
                    <div key={idx} className="wizard-row-edit">
                      <input
                        style={{ width: 84 }}
                        value={lo.code}
                        onChange={(e) =>
                          setOutline((prev) => ({
                            ...prev,
                            learningOutcomes: prev.learningOutcomes.map((x, i) => (i === idx ? { ...x, code: e.target.value } : x)),
                          }))
                        }
                      />
                      <input
                        style={{ flex: 1 }}
                        value={lo.description}
                        onChange={(e) =>
                          setOutline((prev) => ({
                            ...prev,
                            learningOutcomes: prev.learningOutcomes.map((x, i) =>
                              i === idx ? { ...x, description: e.target.value } : x,
                            ),
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Xóa LO"
                        onClick={() =>
                          setOutline((prev) => ({
                            ...prev,
                            learningOutcomes: prev.learningOutcomes.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chapters */}
            <div className="wizard-card">
              <div className="wizard-card-head">
                <h4>Danh sách Chương</h4>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setOutline((prev) => ({
                      ...prev,
                      chapters: [
                        ...prev.chapters,
                        {
                          id: `ch${prev.chapters.length + 1}`,
                          title: `Chương ${prev.chapters.length + 1}: Nội dung mới`,
                          loCodes: prev.learningOutcomes[0] ? [prev.learningOutcomes[0].code] : [],
                          state: 'DRAFT',
                          revision: 1,
                          documentCount: 0,
                        },
                      ],
                    }))
                  }
                >
                  <Plus size={12} /> Thêm chương
                </button>
              </div>
              {outline.chapters.length === 0 ? (
                <p className="muted-s">Chưa có Chương nào. Hãy tải đề cương PDF hoặc bấm "Thêm chương".</p>
              ) : (
                <div className="wizard-list">
                  {outline.chapters.map((ch, idx) => (
                    <div key={ch.id} className="wizard-row-edit">
                      <span className="pill-badge muted">{ch.id}</span>
                      <input
                        style={{ flex: 1 }}
                        value={ch.title}
                        onChange={(e) =>
                          setOutline((prev) => ({
                            ...prev,
                            chapters: prev.chapters.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Xóa chương"
                        onClick={() =>
                          setOutline((prev) => ({
                            ...prev,
                            chapters: prev.chapters.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="wizard-footer-actions">
            <button type="button" className="btn btn-outline" disabled={busy} onClick={handleSaveOutlineDraft}>
              <Save size={13} /> Lưu bản nháp
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || outline.chapters.length === 0 || outline.learningOutcomes.length === 0}
              onClick={handleApproveOutline}
            >
              <CheckCircle2 size={13} /> Duyệt khung môn học (OUTLINE_APPROVED)
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: D2 CHAPTER LESSONS */}
      {step === 2 && (
        <div className="wizard-panel">
          <div className="wizard-panel-head">
            <div>
              <h3>D2. Bài học theo chương (Mỗi lần duyệt ~20 node)</h3>
              <p className="muted-s">Chọn từng chương, tải tài liệu PDF chương đó, sinh bài học và duyệt trước khi chuyển sang Bước 3.</p>
            </div>
            <button type="button" className="btn btn-outline" onClick={() => setStep(3)} disabled={approvedChapters.length < 2}>
              Sang Bước 3: Quan hệ liên chương <ArrowRight size={13} />
            </button>
          </div>

          <div className="wizard-split">
            {/* Chapter sidebar */}
            <aside className="wizard-chapter-list">
              {outline.chapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChapterId(ch.id)}
                  className={`wizard-chapter-item${selectedChapterId === ch.id ? ' on' : ''}`}
                >
                  <div>
                    <b>{ch.title}</b>
                    <small>Rev {ch.revision} · {ch.documentCount ?? 0} tài liệu</small>
                  </div>
                  <span className={`pill-badge ${CHAPTER_STATE_LABEL[ch.state].tone}`}>
                    {CHAPTER_STATE_LABEL[ch.state].text}
                  </span>
                </button>
              ))}
            </aside>

            {/* Selected Chapter Workspace */}
            <div className="wizard-chapter-main">
              {!currentChapter ? (
                <p className="muted-s">Chọn một chương bên trái để bắt đầu.</p>
              ) : (
                <>
                  <div className="wizard-card-head" style={{ marginBottom: 12 }}>
                    <div>
                      <h4>{currentChapter.title}</h4>
                      <span className="muted-s">
                        Trạng thái: <b>{currentChapter.state}</b> · Revision: {currentChapter.revision}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {currentChapter.state === 'PUBLISHED' && (
                        <button type="button" className="btn btn-outline" disabled={busy} onClick={handleReopenChapter}>
                          <RotateCcw size={13} /> Mở lại chương (Reopen)
                        </button>
                      )}
                      {lessons.length > 0 && (
                        <button type="button" className="btn btn-outline" disabled={busy} onClick={handleDiscardChapterDraft}>
                          <Trash2 size={13} /> Hủy bản nháp (Discard)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Upload & Generate Lesson Job */}
                  <div className="wizard-upload-row">
                    <label className="wizard-file-box">
                      <FileText size={15} />
                      <span>{chapterFile ? chapterFile.name : 'Chọn tệp PDF / Slide của chương này...'}</span>
                      <input
                        type="file"
                        accept="application/pdf,.ppt,.pptx,.doc,.docx"
                        hidden
                        onChange={(e) => setChapterFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busy || !chapterFile || currentChapter.state === 'PUBLISHED'}
                      onClick={handleUploadChapterDoc}
                    >
                      <Upload size={13} /> Tải lên chương
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy || currentChapter.state === 'PUBLISHED'}
                      onClick={handleRunLessonJob}
                    >
                      <Play size={13} /> Sinh bài học (Lesson Job)
                    </button>
                  </div>

                  {/* Paginated Lessons Review List */}
                  {lessons.length === 0 ? (
                    <div className="wizard-empty-box">
                      <BookOpen size={22} />
                      <p>Chưa có bài học nào trong bản nháp của chương này. Hãy tải tài liệu chương và bấm "Sinh bài học".</p>
                    </div>
                  ) : (
                    <>
                      <div className="wizard-review-toolbar">
                        <span>Hiển thị {lessons.length} mục</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="btn btn-outline" disabled={busy} onClick={handleBatchApproveLessons}>
                            <Check size={13} /> Duyệt hàng loạt (Batch Review)
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busy || lessons.some((l) => l.decision === 'PENDING')}
                            onClick={handleApproveChapter}
                          >
                            <CheckCircle2 size={13} /> Duyệt chương (LESSON_APPROVED)
                          </button>
                        </div>
                      </div>

                      <div className="wizard-items-list">
                        {lessons.map((lesson) => (
                          <div key={lesson.id} className={`wizard-review-card${lesson.hasWarning ? ' warn' : ''}`}>
                            <div className="wizard-review-top">
                              <div>
                                <b>{lesson.title}</b>
                                <div className="wizard-meta-row">
                                  <span>Nguồn: <code>{lesson.sourceRef}</code></span>
                                  <span>LO: {lesson.loCodes.join(', ')}</span>
                                </div>
                              </div>
                              <span
                                className="pill-badge"
                                style={{ color: DECISION_BADGE[lesson.decision].color, borderColor: DECISION_BADGE[lesson.decision].color }}
                              >
                                {DECISION_BADGE[lesson.decision].text}
                              </span>
                            </div>

                            {editingLessonId === lesson.id ? (
                              <div className="wizard-edit-inline">
                                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                                <textarea rows={2} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => void handleLessonDecision(lesson.id, 'EDIT', { title: editTitle, content: editContent })}
                                  >
                                    Lưu chỉnh sửa
                                  </button>
                                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingLessonId(null)}>
                                    Hủy
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="wizard-item-body">{lesson.content}</p>
                            )}

                            {lesson.aiComment && (
                              <div className={`wizard-ai-note${lesson.hasWarning ? ' warn' : ''}`}>
                                <Sparkles size={12} /> <span>{lesson.aiComment}</span>
                              </div>
                            )}

                            <div className="wizard-item-actions">
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => void handleLessonDecision(lesson.id, 'APPROVE')}
                              >
                                <Check size={12} /> Duyệt
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => {
                                  setEditingLessonId(lesson.id);
                                  setEditTitle(lesson.title);
                                  setEditContent(lesson.content);
                                }}
                              >
                                <Pencil size={12} /> Sửa
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => void handleLessonDecision(lesson.id, 'REJECT')}
                              >
                                <X size={12} /> Từ chối
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {lessonsCursor && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ marginTop: 10 }}
                          onClick={() => void loadChapterLessons(currentChapter.id, true, lessonsCursor)}
                        >
                          Tải thêm bài học
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: D3 CROSS-CHAPTER RELATIONS */}
      {step === 3 && (
        <div className="wizard-panel">
          <div className="wizard-panel-head">
            <div>
              <h3>D3. Quan hệ liên chương</h3>
              <p className="muted-s">Chọn ít nhất 2 chương đã duyệt để AI suy luận quan hệ tiên quyết / liên kết giữa các chương.</p>
            </div>
            <span className="pill-badge muted">Rev {relationRevision}</span>
          </div>

          <div className="wizard-card" style={{ marginBottom: 14 }}>
            <h4 style={{ marginBottom: 8 }}>Chọn các chương đã duyệt (tối thiểu 2 chương):</h4>
            <div className="wizard-checkbox-grid">
              {outline.chapters.map((ch) => {
                const isApproved = ch.state === 'LESSON_APPROVED' || ch.state === 'PUBLISHED';
                const checked = selectedChapterIds.includes(ch.id);
                return (
                  <label key={ch.id} className={`wizard-check-pill${!isApproved ? ' disabled' : ''}${checked ? ' on' : ''}`}>
                    <input
                      type="checkbox"
                      disabled={!isApproved}
                      checked={checked}
                      onChange={() =>
                        setSelectedChapterIds((prev) =>
                          prev.includes(ch.id) ? prev.filter((x) => x !== ch.id) : [...prev, ch.id],
                        )
                      }
                    />
                    <span>{ch.title}</span>
                    <small>({CHAPTER_STATE_LABEL[ch.state].text})</small>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || selectedChapterIds.length < 2}
                onClick={handleRunRelationJob}
              >
                <GitBranch size={13} /> Sinh quan hệ liên chương (Relation Job)
              </button>
              {relations.length > 0 && (
                <button type="button" className="btn btn-outline" disabled={busy} onClick={handleDiscardRelations}>
                  <Trash2 size={13} /> Hủy bản nháp quan hệ
                </button>
              )}
            </div>
          </div>

          {relations.length === 0 ? (
            <div className="wizard-empty-box">
              <GitBranch size={22} />
              <p>Chưa có quan hệ liên chương nào. Chọn tối thiểu 2 chương đã duyệt và bấm "Sinh quan hệ liên chương".</p>
            </div>
          ) : (
            <>
              <div className="wizard-review-toolbar">
                <span>Hiển thị {relations.length} quan hệ</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-outline" disabled={busy} onClick={handleBatchApproveRelations}>
                    <Check size={13} /> Duyệt tất cả (Batch Review)
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setStep(4)}>
                    Sang Bước 4: Xuất bản <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              <div className="wizard-items-list">
                {relations.map((rel) => (
                  <div key={rel.id} className="wizard-review-card">
                    <div className="wizard-review-top">
                      <div>
                        <b>
                          [{rel.sourceChapterId}] {rel.sourceName} ──({rel.relationType})→ [{rel.targetChapterId}] {rel.targetName}
                        </b>
                        <div className="wizard-meta-row">
                          <span>Nguồn: <code>{rel.sourceRef}</code></span>
                        </div>
                      </div>
                      <span
                        className="pill-badge"
                        style={{ color: DECISION_BADGE[rel.decision].color, borderColor: DECISION_BADGE[rel.decision].color }}
                      >
                        {DECISION_BADGE[rel.decision].text}
                      </span>
                    </div>
                    {rel.aiComment && (
                      <div className="wizard-ai-note">
                        <Sparkles size={12} /> <span>{rel.aiComment}</span>
                      </div>
                    )}
                    <div className="wizard-item-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => void handleRelationDecision(rel.id, 'APPROVE')}>
                        <Check size={12} /> Duyệt
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => void handleRelationDecision(rel.id, 'REJECT')}>
                        <X size={12} /> Từ chối
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {relationsCursor && (
                <button type="button" className="btn btn-outline" onClick={() => void loadRelations(true, relationsCursor)}>
                  Tải thêm quan hệ
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* STEP 4: D4 PUBLISH MASTER GRAPH */}
      {step === 4 && (
        <div className="wizard-panel">
          <div className="wizard-panel-head">
            <div>
              <h3>D4. Xuất bản Master Graph theo môn</h3>
              <p className="muted-s">Ghi idempotent sang Neo4j để sinh viên và hệ thống gợi ý học tập sử dụng phiên bản chính thức.</p>
            </div>
            <span className="pill-badge blue">Master v{masterVersion}</span>
          </div>

          <div className="wizard-summary-grid">
            <div className="wizard-stat-box">
              <Layers size={18} />
              <b>{outlineState}</b>
              <span>Trạng thái khung</span>
            </div>
            <div className="wizard-stat-box">
              <BookOpen size={18} />
              <b>{approvedChapters.length} / {outline.chapters.length}</b>
              <span>Chương đã duyệt</span>
            </div>
            <div className="wizard-stat-box">
              <GitBranch size={18} />
              <b>{relations.filter((r) => r.decision !== 'REJECT' && r.decision !== 'PENDING').length}</b>
              <span>Quan hệ liên chương duyệt</span>
            </div>
            <div className="wizard-stat-box">
              <CheckCircle2 size={18} />
              <b>Rev {relationRevision}</b>
              <span>Phiên bản bản nháp</span>
            </div>
          </div>

          {publishWarnings.length > 0 && (
            <div className="wizard-banner error">
              <AlertTriangle size={14} />
              <span>Cảnh báo khi xuất bản: {publishWarnings.join('; ')}</span>
            </div>
          )}

          <div className="wizard-footer-actions">
            {pendingPublicationId && (
              <button type="button" className="btn btn-outline" disabled={busy} onClick={handleRecoverPublish}>
                <RefreshCw size={13} /> Phục hồi xuất bản ({pendingPublicationId})
              </button>
            )}
            <button type="button" className="btn btn-primary" disabled={busy} onClick={handlePublish}>
              <Sparkles size={13} /> Xuất bản Master Graph
            </button>
            {masterVersion > 0 && (
              <button type="button" className="btn btn-outline" onClick={onPublishedGraph}>
                Xem Master Graph trực quan <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

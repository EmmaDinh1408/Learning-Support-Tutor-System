import { FileText, Network, PanelRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { KnowledgeEdgeType, KnowledgeNodeType } from '../../types';
import { useAsync } from '../common/useAsync';
import { useLanguage } from '../i18n/LanguageContext';
import { AppHeader } from '../layout/AppHeader';
import { DocPickerModal } from '../teacher/DocPickerModal';
import { GenerationProgress } from '../teacher/GenerationProgress';
import { LoView } from '../teacher/LoView';
import { KnowledgeGraphCanvas } from './KnowledgeGraphCanvas';

type Phase = 'empty' | 'generating' | 'ready';

interface Props {
  role: 'student' | 'teacher';
}

export function UnifiedCourseGraph({ role }: Props) {
  const canEdit = role === 'teacher';
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const { courseId = '' } = useParams();
  const nav = useNavigate();

  const [phase, setPhase] = useState<Phase>('ready');
  const [editMode, setEditMode] = useState(canEdit);
  const [picker, setPicker] = useState(false);
  const [fileLabel, setFileLabel] = useState('');
  const [rightOpen, setRightOpen] = useState(true);
  const [view, setView] = useState<'structure' | 'outcomes'>('structure');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const ready = phase === 'ready';
  const { data: knowledgeGraph, loading: kgLoading, error: kgError } = useAsync(
    () => (ready && courseId ? api.getKnowledgeGraph(courseId) : Promise.resolve(null)),
    [ready, courseId, reloadTick],
  );
  const { data: files, error: filesError } = useAsync(
    () => (canEdit && courseId ? api.getCoursePdfs(courseId) : Promise.resolve([])),
    [canEdit, courseId],
  );
  const { data: studentCourses, error: studentCoursesError } = useAsync(
    () => (!canEdit ? api.getStudentCourses() : Promise.resolve([])),
    [canEdit],
  );
  const { data: teacherCourses, error: teacherCoursesError } = useAsync(
    () => (canEdit ? api.getTeacherCourses() : Promise.resolve([])),
    [canEdit],
  );

  useEffect(() => {
    setActionError('');
    setActionMessage('');
    setView('structure');
  }, [courseId]);

  const serviceError = [kgError, filesError, studentCoursesError, teacherCoursesError].find(Boolean);
  const coursesList = canEdit ? (teacherCourses ?? []) : (studentCourses ?? []);
  const courseName = coursesList.find((course) => course.id === courseId)?.title ?? courseId;

  const refreshGraph = () => setReloadTick((tick) => tick + 1);

  const startGenerate = (label: string) => {
    setFileLabel(label);
    setPicker(false);
    setPhase('generating');
  };

  const doneGenerating = useCallback(() => {
    setPhase('ready');
    setReloadTick((tick) => tick + 1);
  }, []);

  const handleAddNode = async (input: { name: string; nodeType: KnowledgeNodeType; parentId?: string | null }) => {
    if (!canEdit) return;
    setActionError('');
    setActionMessage('');
    try {
      await api.createGraphNode(courseId, {
        name: input.name,
        nodeType: input.nodeType,
        clusterId: input.parentId ?? null,
      });
      setActionMessage(`Đã thêm nút "${input.name}" (${input.nodeType}) vào đồ thị.`);
      refreshGraph();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể thêm nút.');
    }
  };

  const handleAddEdge = async (input: { fromId: string; toId: string; kind: KnowledgeEdgeType }) => {
    if (!canEdit) return;
    setActionError('');
    setActionMessage('');
    try {
      await api.createGraphEdge(courseId, input);
      setActionMessage(`Đã nối quan hệ ${input.fromId} → ${input.toId} (${input.kind}).`);
      refreshGraph();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể nối quan hệ.');
    }
  };

  const handleMergeNodes = async (input: { keepId: string; mergeId: string }) => {
    if (!canEdit) return;
    setActionError('');
    setActionMessage('');
    try {
      await api.mergeGraphNodes(courseId, input);
      setActionMessage(`Đã gộp ${input.mergeId} vào ${input.keepId}.`);
      refreshGraph();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể gộp nút.');
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!canEdit) return;
    setActionError('');
    setActionMessage('');
    try {
      await api.deleteGraphNode(courseId, nodeId);
      setActionMessage(`Đã xóa nút ${nodeId}.`);
      refreshGraph();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể xóa nút.');
    }
  };

  const handleDeleteEdge = async (input: { fromId: string; toId: string; edgeType: string }) => {
    if (!canEdit) return;
    setActionError('');
    setActionMessage('');
    try {
      await api.deleteGraphEdge(courseId, input);
      setActionMessage(`Đã xóa quan hệ ${input.fromId} → ${input.toId}.`);
      refreshGraph();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể xóa quan hệ.');
    }
  };

  const handleApproveNode = async (nodeId: string) => {
    if (!canEdit) return;
    setActionError('');
    setActionMessage('');
    try {
      await api.updateGraphNode(courseId, nodeId, { approved: true, status: 'approved' });
      setActionMessage('Đã duyệt nút kiến thức.');
      refreshGraph();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể duyệt nút.');
    }
  };

  const handleApproveEdge = async (input: { fromId: string; toId: string; edgeType: string }) => {
    if (!canEdit) return;
    setActionError('');
    setActionMessage('');
    try {
      await api.approveGraphEdge(courseId, input);
      setActionMessage('Đã duyệt quan hệ kiến thức.');
      refreshGraph();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể duyệt quan hệ.');
    }
  };

  const teacherTabs = isVi
    ? ['Lộ trình', 'Nội dung', 'Học viên', 'Điểm số']
    : ['Path', 'Content', 'Students', 'Grades'];
  const studentTabs = isVi
    ? ['Lộ trình kiến nghị', 'Lộ trình cá nhân hóa', 'Nội dung', 'Điểm số']
    : ['Recommended path', 'Personalized path', 'Content', 'Grades'];
  const tabs = canEdit ? teacherTabs : studentTabs;

  const onTabClick = (index: number) => {
    if (canEdit) {
      nav(
        index === 0
          ? `/teacher/courses/${courseId}/graph`
          : `/teacher/courses/${courseId}/${['', 'content', 'students', 'grades'][index]}`,
      );
    } else {
      if (index === 0) nav(`/courses/${courseId}/graph`);
      if (index === 1) nav(`/courses/${courseId}/personalized`);
      if (index === 2) nav(`/courses/${courseId}/content`);
      if (index === 3) nav(`/courses/${courseId}/grades`);
    }
  };

  return (
    <div className={`page graph-page${canEdit ? ' teacher' : ''}`}>
      <AppHeader showEditToggle={canEdit} editMode={editMode} onEditModeChange={setEditMode} />

      <div className="crumbs top">
        <a onClick={() => nav(canEdit ? '/teacher/courses' : '/home')}>{isVi ? 'Trang chủ' : 'Home'}</a>
        <i>›</i>
        <a onClick={() => nav(canEdit ? '/teacher/courses' : '/courses')}>{isVi ? 'Khóa học của tôi' : 'My courses'}</a>
        <i>›</i>
        <a>{courseName}</a>
        <i>›</i>
        <b>{isVi ? 'Đồ thị tri thức' : 'Knowledge graph'}</b>
      </div>

      <div className={`course-subheader${canEdit ? ' teacher' : ''}`}>
        <div className="subheader-center">
          <h1>{courseName}</h1>
          <div className="tabs-pill">
            {tabs.map((label, index) => (
              <button key={label} className={index === 0 ? 'on' : ''} onClick={() => onTabClick(index)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="kg-subheader-actions">
          <div className="kg-view-switch">
            <button type="button" className={view === 'structure' ? 'on' : ''} onClick={() => setView('structure')}>
              {isVi ? 'Đồ thị tri thức' : 'Knowledge graph'}
            </button>
            <button type="button" className={view === 'outcomes' ? 'on' : ''} onClick={() => setView('outcomes')}>
              {isVi ? 'Chuẩn đầu ra' : 'Learning outcomes'}
            </button>
          </div>
          {canEdit && (
            <button type="button" className="btn btn-outline sm" onClick={() => setPicker(true)}>
              <FileText size={12} /> {isVi ? 'Tạo từ PDF' : 'Generate from PDF'}
            </button>
          )}
          <button
            type="button"
            className={`round-btn right${rightOpen ? '' : ' off'}`}
            style={{ position: 'static' }}
            onClick={() => setRightOpen((o) => !o)}
            aria-label="Bảng thuộc tính"
          >
            <PanelRight size={16} />
          </button>
        </div>
      </div>

      {(serviceError || actionError) && (
        <p className="form-error graph-error" role="alert">
          {actionError || serviceError?.message}
        </p>
      )}
      {actionMessage && (
        <p className="admin-success" style={{ margin: '4px 16px' }} role="status">
          {actionMessage}
        </p>
      )}

      {canEdit && phase === 'empty' && (
        <div className="empty-wrap">
          <div className="empty-card">
            <div className="empty-illu">
              <span className="orbit">
                <Network size={18} />
              </span>
            </div>
            <h2>Môn học chưa có đồ thị tri thức</h2>
            <p>
              Tạo đồ thị kiến thức từ tài liệu PDF để AI trích xuất khái niệm, chuẩn đầu ra và quan hệ tiên quyết.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setPicker(true)}>
              <FileText size={12} /> Tạo graph từ tài liệu
            </button>
          </div>
        </div>
      )}

      {canEdit && phase === 'generating' && (
        <div className="gen-page">
          <GenerationProgress
            fileLabel={fileLabel || (isVi ? 'Tài liệu khóa học' : 'Course material')}
            onDone={doneGenerating}
            onCancel={() => setPhase('ready')}
            onChangeFile={() => setPicker(true)}
          />
        </div>
      )}

      {ready && (
        <div className="graph-body" style={{ flex: 1, minHeight: 0 }}>
          {view === 'outcomes' ? (
            <div className="graph-stage">
              <LoView courseId={courseId} />
            </div>
          ) : kgLoading && !knowledgeGraph ? (
            <div className="graph-stage" style={{ display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
              Đang tải đồ thị tri thức…
            </div>
          ) : knowledgeGraph && knowledgeGraph.nodes.length > 0 ? (
            <KnowledgeGraphCanvas
              courseId={courseId}
              data={knowledgeGraph}
              role={role}
              editMode={editMode}
              rightOpen={rightOpen}
              onAddNode={canEdit ? handleAddNode : undefined}
              onAddEdge={canEdit ? handleAddEdge : undefined}
              onMergeNodes={canEdit ? handleMergeNodes : undefined}
              onDeleteNode={canEdit ? handleDeleteNode : undefined}
              onDeleteEdge={canEdit ? handleDeleteEdge : undefined}
              onApproveNode={canEdit ? handleApproveNode : undefined}
              onApproveEdge={canEdit ? handleApproveEdge : undefined}
              onOpenNodeEditor={canEdit ? (id) => nav(`/teacher/courses/${courseId}/nodes/${id}`) : undefined}
              onStartLearning={!canEdit ? () => nav(`/courses/${courseId}/content`) : undefined}
            />
          ) : (
            <div className="empty-wrap">
              <div className="empty-card">
                <div className="empty-illu">
                  <span className="orbit">
                    <Network size={18} />
                  </span>
                </div>
                <h2>Chưa có dữ liệu đồ thị cho môn học này</h2>
                <p>
                  {canEdit
                    ? 'Hãy tải lên tài liệu PDF để AI xây dựng đồ thị kiến thức cho khóa học.'
                    : 'Giảng viên chưa xuất bản đồ thị tri thức cho môn học này.'}
                </p>
                {canEdit && (
                  <button type="button" className="btn btn-primary" onClick={() => setPicker(true)}>
                    <FileText size={12} /> Tạo graph từ tài liệu
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {canEdit && picker && files && (
        <DocPickerModal files={files} onClose={() => setPicker(false)} onSubmit={startGenerate} />
      )}
    </div>
  );
}

export default UnifiedCourseGraph;

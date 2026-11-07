import { ArrowRight, FileText, List, Link2, PanelRight, Plus, Merge, Users, Network, ArrowLeft } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { useAsync } from '../features/common/useAsync';
import { GraphCanvas, type CanvasEdge, type CanvasNode } from '../features/graph/GraphCanvas';
import { Legend } from '../features/graph/Legend';
import { DocPickerModal } from '../features/teacher/DocPickerModal';
import { GenerationProgress } from '../features/teacher/GenerationProgress';
import { ReviewQueuePanel } from '../features/teacher/ReviewQueuePanel';
import { TeacherInspector } from '../features/teacher/TeacherInspector';
import { HeatPanel } from '../features/teacher/HeatPanel';
import { LoView } from '../features/teacher/LoView';
import { ClusterCard, ClusterNodeCard } from '../features/teacher/TeacherNodeViews';

type Phase = 'empty' | 'generating' | 'ready';
const TABS = ['Graph', 'Nội dung', 'Học viên', 'Điểm số', 'Hoạt động', 'Cài đặt'];
const CARD = { w: 130, h: 64 };
const NODE = { w: 190, h: 54 };

export default function TeacherCourseGraphPage() {
  const { courseId = 'CO2003' } = useParams();
  const nav = useNavigate();
  const storeKey = `g4lms.graph.${courseId}`;
  const [phase, setPhaseState] = useState<Phase>(() => (localStorage.getItem(storeKey) as Phase) || 'empty');
  const setPhase = (p: Phase) => { setPhaseState(p); try { localStorage.setItem(storeKey, p); } catch { /* ignore */ } };

  const [editMode, setEditMode] = useState(false);
  const [picker, setPicker] = useState(false);
  const [fileLabel, setFileLabel] = useState('');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const [view, setView] = useState<'structure' | 'outcomes'>('structure');
  const [heat, setHeat] = useState(false);
  const [showRelated, setShowRelated] = useState(false);
  const [clusterId, setClusterId] = useState<string | null>(null); // đang mở cụm
  const [selCluster, setSelCluster] = useState<string | null>(null);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [approved, setApproved] = useState<string[]>([]);

  const ready = phase === 'ready';
  const { data: graph } = useAsync(() => (ready ? api.getTeacherGraph(courseId) : Promise.resolve(null)), [ready, courseId]);
  const { data: queue } = useAsync(() => (ready ? api.getReviewQueue(courseId) : Promise.resolve(null)), [ready, courseId]);
  const { data: files } = useAsync(() => api.getCoursePdfs(courseId), [courseId]);
  const { data: clusterView } = useAsync(() => (clusterId ? api.getClusterView(clusterId) : Promise.resolve(null)), [clusterId]);
  const heatKey = selCluster && (selCluster === 'pointer' || selCluster === 'hash') ? selCluster : 'pointer';
  const { data: spot } = useAsync(() => (heat ? api.getHeatSpot(heatKey) : Promise.resolve(null)), [heat, heatKey]);

  const clusters = useMemo(
    () => (graph?.clusters ?? []).map((c) => ({ ...c, approved: c.approved || approved.includes(c.id) })),
    [graph, approved],
  );
  const clusterMap = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters]);
  const openCluster = clusterId ? clusterMap.get(clusterId) : null;

  /* ---- canvas data ---- */
  const overviewNodes: CanvasNode[] = clusters.map((c) => ({ id: c.id, x: c.x * 1.12, y: c.y, ...CARD }));
  const overviewEdges: CanvasEdge[] = (graph?.clusterEdges ?? [])
    .filter((e) => showRelated || e.kind === 'prereq')
    .map((e) => ({ ...e, active: !!selCluster && (e.from === selCluster || e.to === selCluster) }));

  const innerNodes: CanvasNode[] = (clusterView?.nodes ?? []).map((n) => ({ id: n.id, x: n.x, y: n.y, ...NODE }));
  const innerEdges: CanvasEdge[] = (clusterView?.edges ?? []).filter((e) => showRelated || e.kind === 'prereq');
  const innerMap = new Map((clusterView?.nodes ?? []).map((n) => [n.id, n]));

  /* ---- actions ---- */
  const startGenerate = (label: string) => { setFileLabel(label); setPicker(false); setPhase('generating'); };
  const done = useCallback(() => setPhase('ready'), []); // eslint-disable-line react-hooks/exhaustive-deps

  const focusCluster = (id: string) => { setClusterId(null); setSelNode(null); setSelCluster(id); setRightOpen(true); };
  const enter = (id: string) => { setClusterId(id); setSelCluster(id); setSelNode(null); };
  const leave = () => { setClusterId(null); setSelNode(null); };

  const approveNext = () => {
    const next = clusters.find((c) => !c.approved && c.id !== clusterId);
    if (clusterId) setApproved((a) => [...a, clusterId]);
    if (next) { setClusterId(null); setSelNode(null); setSelCluster(next.id); }
  };
  const approveOne = (id: string) => setApproved((a) => [...a, id]);

  const total = graph?.stats;
  const rightPanel = heat && spot && !clusterId
    ? <HeatPanel spot={spot} />
    : <TeacherInspector
        cluster={selCluster ? clusterMap.get(selCluster) : null}
        node={selNode ? innerMap.get(selNode) : null}
        onOpenCluster={enter}
        onApprove={approveOne}
        onEditNode={(id) => nav(`/teacher/courses/${courseId}/nodes/${id}`)}
      />;

  return (
    <div className="page graph-page teacher">
      <AppHeader showEditToggle editMode={editMode} onEditModeChange={setEditMode} />

      <div className="crumbs top">
        <a onClick={() => nav('/teacher/courses')}>Trang chủ</a><i>›</i>
        <a onClick={() => nav('/teacher/courses')}>Khóa học của tôi</a><i>›</i>
        <a>Cấu trúc dữ liệu và giải thuật</a><i>›</i><b>Graph</b>
      </div>

      <div className="course-subheader teacher">
        <button className={`round-btn left${leftOpen ? '' : ' off'}`} onClick={() => setLeftOpen((o) => !o)} aria-label="Hàng đợi"><List size={16} /></button>
        <div className="subheader-center">
          <h1>Cấu trúc dữ liệu và giải thuật (CO2003)</h1>
          <div className="tabs-pill">{TABS.map((t, i) => <button key={t} className={i === 0 ? 'on' : ''}>{t}</button>)}</div>
        </div>
        <button className={`round-btn right${rightOpen ? '' : ' off'}`} onClick={() => setRightOpen((o) => !o)} aria-label="Inspector"><PanelRight size={16} /></button>
      </div>

      {phase === 'empty' && (
        <div className="empty-wrap">
          <div className="empty-card">
            <div className="empty-illu"><span className="orbit"><Network size={18} /></span></div>
            <h2>Môn học chưa có graph</h2>
            <p>Tạo graph kiến thức từ tài liệu PDF để AI đề xuất các khái niệm và quan hệ tiên quyết. Bạn sẽ duyệt mọi đề xuất trước khi học viên nhìn thấy.</p>
            <button className="btn btn-primary" onClick={() => setPicker(true)}><FileText size={12} /> Tạo graph từ tài liệu</button>
          </div>
        </div>
      )}

      {phase === 'generating' && (
        <div className="gen-page">
          <GenerationProgress fileLabel={fileLabel || 'Cau_truc_du_lieu_va_giai_thuat_Giao_trinh.pdf - 120 trang - 4,2 MB'}
            onDone={done} onCancel={() => setPhase('empty')} onChangeFile={() => setPicker(true)} />
        </div>
      )}

      {ready && (
        <>
          <div className="graph-toolbar">
            <div className="crumbs small">
              <a>Trang chủ</a><i>›</i><a>Khóa học của tôi</a><i>›</i><a>Cấu trúc dữ liệu và giải thuật</a><i>›</i><b>Graph</b>
              {openCluster && <><i>›</i><b>{openCluster.name}</b></>}
            </div>
            <span className="stats">{total?.nodes} node · {total?.edges} cạnh · {total?.drafts} bản nháp AI</span>
            <button className="btn btn-primary" onClick={approveNext}>
              {clusterId ? 'Cụm đã duyệt · Sang cụm tiếp theo' : 'Duyệt cụm tiếp theo'} <ArrowRight size={12} />
            </button>
          </div>

          <div className="graph-body three">
            {leftOpen && queue && (
              <ReviewQueuePanel queue={queue} onPick={(it) => {
                const c = clusters.find((x) => x.name === it.cluster);
                if (c) focusCluster(c.id);
              }} />
            )}

            <div className="graph-stage">
              <div className="stage-tabs">
                <button className={view === 'structure' ? 'on' : ''} onClick={() => setView('structure')}>Cấu trúc</button>
                <button className={view === 'outcomes' ? 'on' : ''} onClick={() => setView('outcomes')}>Chuẩn đầu ra</button>
              </div>

              {view === 'structure' && (
                <div className="stage-left">
                  {clusterId ? (
                    <button className="btn btn-outline sm" onClick={leave}><ArrowLeft size={11} /> Toàn bộ cụm</button>
                  ) : (
                    <button className={`btn btn-outline sm class-btn${heat ? ' on' : ''}`} onClick={() => setHeat((h) => !h)}>
                      <Users size={12} /> Lớp học
                    </button>
                  )}
                </div>
              )}

              {view === 'outcomes' ? (
                <LoView />
              ) : clusterId ? (
                <GraphCanvas key={`in-${clusterId}`} nodes={innerNodes} edges={innerEdges} fitKey={clusterId}
                  onBackgroundClick={() => setSelNode(null)}
                  renderNode={(id) => {
                    const n = innerMap.get(id)!;
                    return <ClusterNodeCard node={n} selected={selNode === id} onSelect={() => { setSelNode(id); setRightOpen(true); }} />;
                  }} />
              ) : (
                <GraphCanvas key="overview" nodes={overviewNodes} edges={overviewEdges} fitKey="overview"
                  onBackgroundClick={() => setSelCluster(null)}
                  renderNode={(id) => {
                    const c = clusterMap.get(id)!;
                    return <ClusterCard cluster={c} selected={selCluster === id} heat={heat}
                      onSelect={() => { setSelCluster(id); setRightOpen(true); }} onOpen={() => enter(id)} />;
                  }} />
              )}

              {view === 'structure' && (
                <>
                  <div className="float-toolbar">
                    <button><Plus size={12} /> Thêm node</button>
                    <button><Link2 size={12} /> Nối cạnh</button>
                    <button><Merge size={12} /> Gộp</button>
                  </div>
                  {heat && !clusterId ? (
                    <div className="legend heat-legend">
                      <div className="legend-title">% học viên gặp khó khăn</div>
                      <div className="legend-row"><i className="dot high" /> Từ 30%</div>
                      <div className="legend-row"><i className="dot mid" /> 20–29%</div>
                      <div className="legend-row"><i className="dot low" /> Dưới 20%</div>
                    </div>
                  ) : (
                    <Legend className="stage-legend" showRelated={showRelated} onToggle={() => setShowRelated((v) => !v)} />
                  )}
                </>
              )}
            </div>

            {rightOpen && rightPanel}
          </div>
        </>
      )}

      {picker && files && (
        <DocPickerModal files={files} onClose={() => setPicker(false)} onSubmit={startGenerate} />
      )}
    </div>
  );
}


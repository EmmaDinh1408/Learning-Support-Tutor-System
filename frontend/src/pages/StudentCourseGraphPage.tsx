import { ArrowLeft, PanelRight, List } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { useAsync } from '../features/common/useAsync';
import { GraphCanvas, type CanvasEdge, type CanvasNode } from '../features/graph/GraphCanvas';
import { LegendInline } from '../features/graph/Legend';
import { LoPanel } from '../features/graph/LoPanel';
import { NodeDetailPanel } from '../features/graph/NodeDetailPanel';
import { StudentNodeView } from '../features/graph/StudentNodeView';

const TABS = ['Bản đồ', 'Nội dung', 'Điểm số', 'Năng lực'];
const NODE_W = 120;
const NODE_H = 96;

export default function StudentCourseGraphPage() {
  
  const { courseId = 'CO2003' } = useParams();
  const [cluster, setCluster] = useState<string | null>(null);
  const [lo, setLo] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showRelated, setShowRelated] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(false);

  const { data: graph } = useAsync(() => api.getStudentGraph(courseId, cluster ?? undefined), [courseId, cluster]);
  const { data: los } = useAsync(() => api.getLearningOutcomes(), []);
  const { data: detail } = useAsync(() => (selected ? api.getNodeDetail(selected) : Promise.resolve(null)), [selected]);

  const nodes: CanvasNode[] = useMemo(
    () => (graph?.nodes ?? []).map((n) => ({ id: n.id, x: n.x, y: n.y, w: NODE_W, h: NODE_H, inset: NODE_W / 2 - 17 })),
    [graph],
  );
  const nodeMap = useMemo(() => new Map((graph?.nodes ?? []).map((n) => [n.id, n])), [graph]);

  const edges: CanvasEdge[] = useMemo(
    () =>
      (graph?.edges ?? [])
        .filter((e) => showRelated || e.kind === 'prereq')
        .map((e) => {
          const a = nodeMap.get(e.from), b = nodeMap.get(e.to);
          const dim = !!lo && (a?.lo !== lo || b?.lo !== lo);
          return { ...e, dim, active: !!selected && (e.from === selected || e.to === selected) };
        }),
    [graph, showRelated, lo, selected, nodeMap],
  );

  const open = (id: string) => {
    const n = nodeMap.get(id);
    if (!cluster && n?.id === 'pointer') { setCluster('pointer'); setSelected(null); return; }
    setSelected(id);
    setRightOpen(true);
  };

  const back = () => { setCluster(null); setSelected(null); };
  const reviewTarget = { title: 'Cấp phát động', cluster: 'Con trỏ', mastery: 42 };

  return (
    <div className="page graph-page">
      <AppHeader />
      <div className="course-subheader">
        <button className="round-btn left" aria-label="Mục lục" onClick={() => setOutlineOpen((o) => !o)}><List size={16} /></button>
        <div className="subheader-center">
          <h1>Cấu trúc dữ liệu và giải thuật (CO2003)</h1>
          <div className="tabs-pill">
            {TABS.map((t, i) => <button key={t} className={i === 0 ? 'on' : ''}>{t}</button>)}
          </div>
        </div>
        <button className={`round-btn right${rightOpen ? '' : ' off'}`} aria-label="Bảng bên phải" onClick={() => setRightOpen((o) => !o)}><PanelRight size={16} /></button>
      </div>

      <div className="graph-body">
        {outlineOpen && (
          <aside className="outline-drawer">
            <b>Mục lục</b>
            {(['Toàn khóa', ...(graph?.nodes.map((n) => n.label) ?? [])]).map((l) => <div key={l}>{l}</div>)}
          </aside>
        )}
        <div className="graph-stage">
          <div className="stage-top">
            {cluster ? (
              <div className="crumb-chip"><button onClick={back}><ArrowLeft size={11} /> Toàn khóa</button><span>/</span><b>Con trỏ</b></div>
            ) : (
              <div className="crumb-chip"><b>Toàn khóa</b></div>
            )}
            <LegendInline showRelated={showRelated} onToggle={() => setShowRelated((v) => !v)} />
          </div>
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            fitKey={cluster ?? 'root'}
            onBackgroundClick={() => setSelected(null)}
            renderNode={(id) => {
              const n = nodeMap.get(id)!;
              return <StudentNodeView node={n} selected={selected === id} dim={!!lo && n.lo !== lo} onClick={() => open(id)} />;
            }}
          />
        </div>

        {rightOpen && (selected && detail ? (
          <NodeDetailPanel detail={detail} />
        ) : (
          <LoPanel los={los ?? []} selected={lo} onSelect={setLo} next={reviewTarget}
            onReview={() => { setCluster('pointer'); setSelected('ptr_alloc'); }} />
        ))}
      </div>
    </div>
  );
}

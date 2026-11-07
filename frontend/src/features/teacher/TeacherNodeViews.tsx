import { ChevronRight } from 'lucide-react';
import type { TeacherCluster, TeacherNode } from '../../types';

export type HeatLevel = 'high' | 'mid' | 'low';
export const heatLevel = (pct: number): HeatLevel => (pct >= 30 ? 'high' : pct >= 20 ? 'mid' : 'low');

interface ClusterProps {
  cluster: TeacherCluster;
  selected: boolean;
  heat: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

export function ClusterCard({ cluster, selected, heat, onSelect, onOpen }: ClusterProps) {
  const level = heatLevel(cluster.struggle);
  return (
    <div
      className={`tc${selected ? ' sel' : ''}${cluster.issue && !heat ? ` issue-${cluster.issue.level}` : ''}${heat ? ` heat-${level}` : ''}`}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      {cluster.issue && !heat && <span className={`tc-flag ${cluster.issue.level}`}>{cluster.issue.label}</span>}
      {heat && level !== 'low' && <span className={`tc-flag heat-${level}`}>{cluster.struggle}% khó khăn</span>}
      <div className="tc-top"><span className="tc-num">{cluster.index}</span><b>{cluster.name}</b></div>
      <small>{cluster.nodeCount} node</small>
      <div className="tc-bottom">
        {cluster.lo.map((l) => <span key={l} className="lo-chip sm">{l}</span>)}
        <button className="tc-open" onClick={(e) => { e.stopPropagation(); onOpen(); }}>Mở cụm <ChevronRight size={9} /></button>
      </div>
    </div>
  );
}

interface NodeProps {
  node: TeacherNode;
  selected: boolean;
  onSelect: () => void;
}

export function ClusterNodeCard({ node, selected, onSelect }: NodeProps) {
  if (node.ghost) {
    return (
      <div className="tn ghost" onClick={onSelect}>
        <b>{node.name}</b>
        <small>từ cụm {node.ghostFrom}</small>
      </div>
    );
  }
  return (
    <div className={`tn${selected ? ' sel' : ''}${node.status === 'Bản nháp' ? ' draft' : ''}`} onClick={onSelect}>
      <b>{node.name}</b>
      <small>{node.status}</small>
    </div>
  );
}

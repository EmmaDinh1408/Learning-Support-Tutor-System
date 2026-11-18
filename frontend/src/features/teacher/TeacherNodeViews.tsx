import { ChevronRight } from 'lucide-react';
import type { TeacherCluster, TeacherNode } from '../../types';
import { teacherNodeStatusLabel } from './statusLabels';

export type HeatLevel = 'high' | 'mid' | 'low';
export const heatLevel = (pct: number): HeatLevel => (pct >= 30 ? 'high' : pct >= 20 ? 'mid' : 'low');

interface ClusterProps {
  cluster: TeacherCluster;
  selected: boolean;
  heat: boolean;
  readOnly?: boolean;
  dim?: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

export function ClusterCard({ cluster, selected, heat, readOnly = false, dim = false, onSelect, onOpen }: ClusterProps) {
  const level = heatLevel(cluster.struggle);
  const showIssue = !readOnly && !!cluster.issue && !heat;
  return (
    <div
      className={`tc${selected ? ' sel' : ''}${showIssue ? ` issue-${cluster.issue!.level}` : ''}${heat && !readOnly ? ` heat-${level}` : ''}${dim ? ' dim' : ''}`}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      {showIssue && <span className={`tc-flag ${cluster.issue!.level}`}>{cluster.issue!.label}</span>}
      {!readOnly && heat && level !== 'low' && <span className={`tc-flag heat-${level}`}>{cluster.struggle}% khó khăn</span>}
      <div className="tc-top"><span className="tc-num">{cluster.index}</span><b>{cluster.name}</b></div>
      <small>{cluster.nodeCount} node</small>
      <div className="tc-bottom">
        {cluster.lo.map((l) => <span key={l} className="lo-chip sm">{l}</span>)}
        <button type="button" className="tc-open" onClick={(e) => { e.stopPropagation(); onOpen(); }}>Mở cụm <ChevronRight size={9} /></button>
      </div>
    </div>
  );
}

interface NodeProps {
  node: TeacherNode;
  selected: boolean;
  dim?: boolean;
  onSelect: () => void;
}

export function ClusterNodeCard({ node, selected, dim = false, onSelect }: NodeProps) {
  if (node.ghost) {
    return (
      <div className={`tn ghost${dim ? ' dim' : ''}`} onClick={onSelect}>
        <b>{node.name}</b>
        <small>từ cụm {node.ghostFrom}</small>
      </div>
    );
  }
  return (
    <div className={`tn${selected ? ' sel' : ''}${node.status === 'draft' ? ' draft' : ''}${dim ? ' dim' : ''}`} onClick={onSelect}>
      <b>{node.name}</b>
      <small>{teacherNodeStatusLabel(node.status)}</small>
    </div>
  );
}

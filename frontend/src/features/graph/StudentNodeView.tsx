import { Check, Lock, BookOpen, AlertTriangle } from 'lucide-react';
import type { StudentNode } from '../../types';

interface Props {
  node: StudentNode;
  selected: boolean;
  dim: boolean;
  onClick: () => void;
}

export function StudentNodeView({ node, selected, dim, onClick }: Props) {
  let inner;
  switch (node.status) {
    case 'mastered': inner = <Check size={14} strokeWidth={3} />; break;
    case 'locked': inner = <Lock size={11} />; break;
    case 'review': inner = <AlertTriangle size={12} />; break;
    case 'available': inner = <BookOpen size={12} />; break;
    default: inner = <span className="sn-pct">{node.mastery ?? 0}%</span>;
  }
  return (
    <div className={`sn sn-${node.status}${selected ? ' sel' : ''}${dim ? ' dim' : ''}`} onClick={onClick} title={node.label}>
      {node.tag && <span className="sn-tag">{node.tag}</span>}
      {node.lo && !node.tag && <span className="sn-lo">{node.lo}</span>}
      <div className="sn-circle">{inner}</div>
      <div className="sn-label">{node.label}</div>
      {node.sub && <div className="sn-sub">{node.sub}</div>}
    </div>
  );
}

import { Award, ArrowRight, Sparkles } from 'lucide-react';
import type { LearningOutcome } from '../../types';
import { ProgressBar } from '../common/ProgressBar';

interface Props {
  los: LearningOutcome[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  next: { title: string; cluster: string; mastery: number } | null;
  onReview: () => void;
}

export function LoPanel({ los, selected, onSelect, next, onReview }: Props) {
  return (
    <aside className="side-panel">
      <div className="panel-heading"><Award size={12} /> CHUẨN ĐẦU RA</div>
      <div className="lo-list">
        {los.map((lo) => (
          <button key={lo.id} className={`lo-item${selected === lo.id ? ' on' : ''}`} onClick={() => onSelect(selected === lo.id ? null : lo.id)}>
            <span className="lo-id">{lo.id}</span>
            <span className="lo-title">{lo.title}</span>
            <ProgressBar value={lo.percent} tone="purple" />
            <span className="lo-meta">{lo.done}/{lo.total} · {lo.percent}%</span>
          </button>
        ))}
      </div>
      {next && (
        <div className="next-card">
          <div className="panel-heading teal"><Sparkles size={12} /> TIẾP THEO</div>
          <b>{next.title}</b>
          <span className="muted-s">{next.cluster} · {next.mastery}% làm chủ</span>
          <button className="btn btn-primary btn-block" onClick={onReview}>Ôn ngay <ArrowRight size={12} /></button>
        </div>
      )}
    </aside>
  );
}

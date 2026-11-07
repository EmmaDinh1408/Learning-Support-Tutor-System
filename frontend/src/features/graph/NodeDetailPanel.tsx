import { ArrowRight, Check, Lock, Sparkles } from 'lucide-react';
import type { NodeDetail } from '../../types';

export function NodeDetailPanel({ detail }: { detail: NodeDetail }) {
  const tone = detail.status === 'mastered' ? 'ok' : detail.status === 'review' ? 'warn' : 'muted';
  return (
    <aside className="side-panel detail">
      <div className="detail-card">
        <span className={`status-chip ${tone}`}>{detail.statusLabel}</span>
        <h2>{detail.title}</h2>
        <div className="muted-s">{detail.cluster} · {detail.course}</div>

        <div className="mastery-box"><b>{detail.mastery}%</b><span>Mức độ làm chủ</span></div>
        <div className="lo-contrib">Đóng góp chuẩn đầu ra <span className="lo-chip">{detail.lo}</span></div>

        <h3>Điều kiện tiên quyết</h3>
        {detail.prerequisites.length === 0 ? (
          <p className="muted-s">Không có điều kiện tiên quyết.</p>
        ) : (
          detail.prerequisites.map((p) => (
            <div key={p.title} className={`prereq-row${p.done ? ' done' : ''}`}>
              {p.done ? <Check size={12} /> : <Lock size={12} />}
              <div><b>{p.title}</b><span>{p.state}</span></div>
            </div>
          ))
        )}

        {detail.aiHint && (
          <div className="ai-hint">
            <div className="ai-hint-title"><Sparkles size={12} /> Gợi ý từ AI</div>
            <p>{detail.aiHint}</p>
          </div>
        )}
        <button className="btn btn-primary btn-block">{detail.cta} <ArrowRight size={12} /></button>
      </div>
    </aside>
  );
}

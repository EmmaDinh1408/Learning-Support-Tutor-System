import { AlertTriangle, ChevronRight, FileWarning, Sparkles, Target } from 'lucide-react';
import type { QueueItem, QueueSummary } from '../../types';

interface Props {
  queue: QueueSummary;
  onPick: (item: QueueItem) => void;
}

export function ReviewQueuePanel({ queue, onPick }: Props) {
  return (
    <aside className="queue-panel">
      <div className="queue-head">
        <div><small>HÀNG ĐỢI</small><h3>Cần xử lý</h3></div>
        <span className="count-badge">{queue.total}</span>
      </div>
      <ul className="queue-stats">
        <li><Sparkles size={12} className="c-blue" /><b>{queue.pending}</b> chờ duyệt</li>
        <li><FileWarning size={12} className="c-orange" /><b>{queue.missingTest}</b> thiếu bài test</li>
        <li><AlertTriangle size={12} className="c-red" /><b>{queue.cycleWarn}</b> cảnh báo chu trình</li>
        <li><Target size={12} className="c-orange" /><b>{queue.noLo}</b> chưa gán LO</li>
      </ul>
      <div className="queue-list">
        {queue.items.map((it) => (
          <button key={it.id} className="queue-item" onClick={() => onPick(it)}>
            <span className={`q-ico ${it.severity}`}>
              {it.severity === 'error' ? <AlertTriangle size={12} /> : it.severity === 'warn' ? <Target size={12} /> : <Sparkles size={12} />}
            </span>
            <span className="q-text">
              <b>{it.title}</b>
              <small>{it.cluster}</small>
              <em className={`tag ${it.severity}`}>{it.tag}</em>
            </span>
            <ChevronRight size={12} />
          </button>
        ))}
      </div>
    </aside>
  );
}

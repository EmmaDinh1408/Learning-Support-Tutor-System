import { ArrowRight } from 'lucide-react';
import { api } from '../../api/client';
import { useAsync } from '../common/useAsync';

export function LoView({ courseId }: { courseId: string }) {
  const { data, error } = useAsync(() => api.getLoChains(courseId), [courseId]);
  return (
    <div className="lo-view">
      {error && <p className="form-error" role="alert">{error.message}</p>}
      {(data ?? []).map((row) => (
        <div key={row.lo} className="lo-row">
          <span className="lo-chip">{row.lo}</span>
          <div className="lo-chain">
            {row.steps.map((s) => (
              <span key={s} className="lo-step">
                <span className="lo-card">{s}</span><ArrowRight size={12} />
              </span>
            ))}
            <span className="diamond" /><span className="diamond" />
            <span className="lo-end"><b>{row.end}</b><small>{row.title}</small></span>
          </div>
        </div>
      ))}
      <div className="legend lo-legend">
        <div className="legend-row"><i className="ln ln-prereq" /> Đóng góp LO</div>
        <div className="legend-row"><i className="ln ln-related" /> Tiên quyết bài tập</div>
        <div className="legend-row"><i className="ln ln-develop" /> DEVELOP</div>
      </div>
    </div>
  );
}

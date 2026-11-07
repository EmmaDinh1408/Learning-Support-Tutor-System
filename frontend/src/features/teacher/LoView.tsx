import { ArrowRight } from 'lucide-react';
import { api } from '../../api/client';
import { useAsync } from '../common/useAsync';

export function LoView() {
  const { data } = useAsync(() => api.getLoChains(), []);
  return (
    <div className="lo-view">
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
      <div className="lo-banner"><span className="c-red">● Chưa gán LO</span> · 3 node · Con trỏ hàm, Ứng dụng bảng băm, Cây khung nhỏ nhất</div>
      <div className="legend lo-legend">
        <div className="legend-row"><i className="ln ln-prereq" /> Đóng góp LO</div>
        <div className="legend-row"><i className="ln ln-related" /> Tiên quyết bài tập</div>
        <div className="legend-row"><i className="ln ln-develop" /> DEVELOP</div>
      </div>
    </div>
  );
}

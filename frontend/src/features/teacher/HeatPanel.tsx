import { AlertTriangle, BookOpen, Users } from 'lucide-react';
import type { HeatSpot } from '../../types';

export function HeatPanel({ spot }: { spot: HeatSpot }) {
  const pct = Math.round((spot.struggling / spot.total) * 100);
  return (
    <aside className="inspector">
      <div className="inspector-head">
        <div><small>LỚP HỌC</small><h3>Điểm nóng</h3></div>
        <span className="count-badge">{pct}%</span>
      </div>
      <div className="inspector-body">
        <div className="hot-card">
          <AlertTriangle size={16} className="c-red" />
          <div>
            <small>{spot.cluster}</small>
            <h2>{spot.node}</h2>
            <b className="c-red">{spot.struggling}/{spot.total} học viên đang gặp khó khăn</b>
          </div>
        </div>
        <h4 className="sec"><Users size={12} /> Học viên cần hỗ trợ</h4>
        {spot.students.map((s) => (
          <div key={s.name} className="stu-row">
            <span className="avatar-sm">{s.initials}</span>
            <div><b>{s.name}</b><small>{s.meta}</small></div>
            <span className="c-red pct">{s.percent}%</span>
          </div>
        ))}
      </div>
      <div className="inspector-foot">
        <button className="btn btn-primary btn-block"><Users size={12} /> Giao ôn tập</button>
        <button className="btn btn-outline btn-block"><BookOpen size={12} /> Mở bài giảng</button>
      </div>
    </aside>
  );
}

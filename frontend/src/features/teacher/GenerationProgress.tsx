import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';

const STEPS = ['Đọc PDF', 'Chia đoạn', 'Trích khái niệm', 'Nối quan hệ'];

interface Props {
  fileLabel: string;
  onDone: () => void;
  onCancel: () => void;
  onChangeFile: () => void;
}

export function GenerationProgress({ fileLabel, onDone, onCancel, onChangeFile }: Props) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPct((p) => Math.min(100, p + 4)), 250);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (pct >= 100) onDone(); }, [pct, onDone]);

  const active = Math.min(3, Math.floor(pct / 25));

  return (
    <div className="gen-wrap">
      <h2>Tạo graph kiến thức</h2>
      <div className="file-bar">
        <span><FileText size={12} /> {fileLabel}</span>
        <a href="#" onClick={(e) => { e.preventDefault(); onChangeFile(); }}>Đổi tài liệu</a>
      </div>
      <div className="gen-card">
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`step${i === active ? ' active' : ''}${i < active ? ' done' : ''}`}>
              <div className="step-head"><span className="step-num">{i < active ? '✓' : i === active ? '○' : i + 1}</span>{s}</div>
              <div className="step-state">{i < active ? 'Hoàn tất' : i === active ? 'Đang xử lý' : 'Đang chờ'}</div>
            </div>
          ))}
        </div>
        <div className="gen-status"><span>Đang xử lý: {STEPS[active]}</span><b>{pct}%</b></div>
        <div className="gen-bar"><div style={{ width: `${pct}%` }} /></div>
        <div className="gen-foot">
          <span className="muted-s">Bạn có thể rời trang, hệ thống sẽ thông báo khi hoàn tất</span>
          <button className="btn btn-outline" onClick={onCancel}>Hủy</button>
        </div>
      </div>
    </div>
  );
}

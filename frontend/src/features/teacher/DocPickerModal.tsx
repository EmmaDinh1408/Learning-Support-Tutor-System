import { FileText, Search, Sparkles, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { PdfFile } from '../../types';

interface Props {
  files: PdfFile[];
  onClose: () => void;
  onSubmit: (label: string) => void;
}

export function DocPickerModal({ files, onClose, onSubmit }: Props) {
  const [tab, setTab] = useState<'course' | 'upload'>('upload');
  const [selected, setSelected] = useState<string[]>(files[0] ? [files[0].id] : []);
  const [q, setQ] = useState('');
  const [uploaded, setUploaded] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const filtered = files.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const count = tab === 'course' ? selected.length : uploaded ? 1 : 1;

  const submit = () => {
    if (tab === 'upload' && uploaded) return onSubmit(`${uploaded.name} - ${(uploaded.size / 1048576).toFixed(1)} MB`);
    const f = files.find((x) => x.id === selected[0]) ?? files[0];
    onSubmit(`${f.name} - ${f.pages} trang - ${String(f.sizeMb).replace('.', ',')} MB`);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head"><h3>Chọn tài liệu</h3><button onClick={onClose} aria-label="Đóng"><X size={16} /></button></div>
        <div className="modal-body">
          <p className="muted-s">AI đọc tài liệu PDF và đề xuất node kiến thức cùng 4 loại quan hệ: Tiên quyết, Song song, Là một phần của, Liên quan.</p>
          <div className="modal-tabs">
            <button className={tab === 'course' ? 'on' : ''} onClick={() => setTab('course')}>Từ tệp khóa học</button>
            <button className={tab === 'upload' ? 'on' : ''} onClick={() => setTab('upload')}>Tải lên mới</button>
          </div>

          {tab === 'course' ? (
            <div className="file-picker">
              <label className="search full"><Search size={12} /><input placeholder="Tìm tệp PDF trong khóa học" value={q} onChange={(e) => setQ(e.target.value)} /></label>
              <div className="file-list">
                {filtered.map((f) => (
                  <label key={f.id} className={`file-row${selected.includes(f.id) ? ' on' : ''}`}>
                    <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggle(f.id)} />
                    <FileText size={14} />
                    <div><b>{f.name}</b><span>{f.pages} trang · {String(f.sizeMb).replace('.', ',')} MB · {f.date}</span></div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setUploaded(f); }}>
              <Upload size={18} />
              <b>Kéo và thả tệp PDF vào đây</b>
              <span className="muted-s">hoặc</span>
              <button className="btn btn-outline" onClick={() => input.current?.click()}><FileText size={12} /> Chọn tệp PDF</button>
              <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => setUploaded(e.target.files?.[0] ?? null)} />
              {uploaded && <div className="uploaded">{uploaded.name}</div>}
              <p className="muted-xs">Chỉ hỗ trợ PDF · tối đa 50 MB mỗi tệp. Tệp tải lên cũng được lưu vào khóa học.</p>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <span className="muted-s">Đã chọn {count} tệp</span>
          <div>
            <button className="btn btn-outline" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" onClick={submit}><Sparkles size={12} /> Tạo graph</button>
          </div>
        </div>
      </div>
    </div>
  );
}

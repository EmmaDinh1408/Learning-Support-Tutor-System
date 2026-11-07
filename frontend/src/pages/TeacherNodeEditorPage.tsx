import { ArrowLeft, FileText, HelpCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { useAsync } from '../features/common/useAsync';

type Tab = 'desc' | 'content' | 'quiz' | 'prereq';
const BLOOM = ['Nhớ', 'Hiểu', 'Áp dụng', 'Phân tích', 'Đánh giá', 'Sáng tạo'];
const DIFF = ['Dễ', 'Vừa', 'Khó'];

export default function TeacherNodeEditorPage() {
  const { courseId = 'CO2003', nodeId = 'insert' } = useParams();
  const nav = useNavigate();
  const { data } = useAsync(() => api.getNodeEditor(nodeId), [nodeId]);
  const [tab, setTab] = useState<Tab>('desc');
  const [name, setName] = useState<string | null>(null);
  const [desc, setDesc] = useState<string | null>(null);
  const [qs, setQs] = useState<Record<string, { bloom?: string; difficulty?: string }>>({});
  const [removed, setRemoved] = useState<string[]>([]);

  if (!data) return <div className="page"><AppHeader showEditToggle /></div>;
  const back = () => nav(`/teacher/courses/${courseId}/graph`);
  const questions = data.questions.filter((q) => !removed.includes(q.id));
  const nameV = name ?? data.name;
  const descV = desc ?? data.description;

  return (
    <div className="page editor-page">
      <AppHeader showEditToggle />
      <div className="editor-topbar">
        <button className="btn btn-outline" onClick={back}><ArrowLeft size={12} /> Quay lại</button>
        <div className="crumbs small"><a>{data.course}</a><i>›</i><a>{data.group}</a><i>›</i><b>{data.parentNode}</b></div>
      </div>

      <div className="editor-head">
        <button className="btn btn-outline" onClick={back}><ArrowLeft size={12} /> Graph</button>
        <div>
          <div className="crumbs xs"><a>{data.course}</a><i>›</i><a>{data.cluster}</a><i>›</i><b>{nameV}</b></div>
          <h1>{nameV}</h1>
        </div>
        <button className="btn btn-primary" onClick={back}>Lưu và quay lại graph</button>
      </div>

      <div className="editor-tabs">
        {([
          ['desc', 'Mô tả'], ['content', 'Nội dung'], ['quiz', 'Câu hỏi'], ['prereq', 'Tiên quyết'],
        ] as [Tab, string][]).map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}
            {k === 'content' && <span className="n">{data.contents.length}</span>}
            {k === 'quiz' && <span className="n">{questions.length}</span>}
            {k === 'prereq' && <span className="n">{data.prerequisites.length}</span>}
          </button>
        ))}
      </div>

      <main className="editor-main">
        {tab === 'desc' && (
          <section className="ed-card">
            <header><div><small>THÔNG TIN NODE</small><h2>Mô tả khái niệm</h2></div><span>Xác định một khái niệm rõ ràng và kết quả học tập mong đợi.</span></header>
            <div className="ed-form">
              <div className="ed-row"><label>Tên node</label><input value={nameV} onChange={(e) => setName(e.target.value)} /></div>
              <div className="ed-row"><label>Cụm kiến thức</label><span className="pill-tag">{data.cluster}</span></div>
              <div className="ed-row top"><label>Mô tả</label><textarea rows={5} value={descV} onChange={(e) => setDesc(e.target.value)} /></div>
              <div className="ed-row"><span /><small className="muted-s">Mô tả chỉ tập trung vào khái niệm {nameV}.</small></div>
            </div>
          </section>
        )}

        {tab === 'content' && (
          <section className="ed-card">
            <header><div><small>CONTENT</small><h2>Nội dung học tập</h2></div><span>Các định nghĩa và ví dụ được trích từ tài liệu nguồn.</span></header>
            <div className="content-list">
              {data.contents.map((c) => (
                <div key={c.id} className="content-item">
                  <span className={`c-ico ${c.status === 'Đã duyệt' ? 'blue' : 'green'}`}><FileText size={14} /></span>
                  <div className="c-main">
                    <div className="c-tags">
                      <span className="tag-kind">{c.kind}</span>
                      <span className={`tag-status ${c.status === 'Đã duyệt' ? 'ok' : 'draft'}`}>{c.status}</span>
                    </div>
                    <b>{c.title}</b>
                    <small>{c.source}</small>
                  </div>
                  <button className="btn btn-outline sm">Chỉnh sửa</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'quiz' && (
          <section className="ed-card">
            <header><div><small>ITEM</small><h2>Câu hỏi đánh giá</h2></div><span>{questions.length} câu dùng để đo mức độ làm chủ {nameV}.</span></header>
            <div className="rule-box"><HelpCircle size={14} /><div><b>Quy tắc</b><span>Mỗi câu hỏi chỉ kiểm tra một khái niệm</span></div></div>
            <table className="q-table">
              <thead><tr><th>Câu</th><th>Nội dung</th><th /><th>Mức Bloom</th><th>Độ khó</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {questions.map((q, i) => (
                  <tr key={q.id}>
                    <td><span className="q-no">{i + 1}</span></td>
                    <td className="q-text">{q.text}</td>
                    <td><button className="icon-plain" onClick={() => setRemoved((r) => [...r, q.id])} aria-label="Xóa"><Trash2 size={12} /></button></td>
                    <td>
                      <select value={qs[q.id]?.bloom ?? q.bloom} onChange={(e) => setQs((s) => ({ ...s, [q.id]: { ...s[q.id], bloom: e.target.value } }))}>
                        {BLOOM.map((b) => <option key={b}>{b}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={qs[q.id]?.difficulty ?? q.difficulty} onChange={(e) => setQs((s) => ({ ...s, [q.id]: { ...s[q.id], difficulty: e.target.value } }))}>
                        {DIFF.map((b) => <option key={b}>{b}</option>)}
                      </select>
                    </td>
                    <td><span className={`tag-status ${q.status === 'Đã duyệt' ? 'ok' : 'draft'}`}>{q.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'prereq' && (
          <section className="ed-card">
            <header><div><small>PREREQUISITE</small><h2>Điều kiện tiên quyết</h2></div><span>Các node học viên cần nắm trước khi học node này.</span></header>
            <div className="content-list">
              {data.prerequisites.map((p) => (
                <div key={p} className="content-item"><span className="c-ico blue"><FileText size={14} /></span><div className="c-main"><b>{p}</b><small>Tiên quyết (bắt buộc)</small></div></div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

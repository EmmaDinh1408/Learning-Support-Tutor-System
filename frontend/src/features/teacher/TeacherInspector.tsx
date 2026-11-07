import { FolderOpen, Pencil, Plus, Target, X, Sparkles, CheckCircle2 } from 'lucide-react';
import type { TeacherCluster, TeacherNode } from '../../types';

interface Props {
  cluster?: TeacherCluster | null;
  node?: TeacherNode | null;
  onOpenCluster: (id: string) => void;
  onApprove: (id: string) => void;
  onEditNode: (id: string) => void;
}

export function TeacherInspector({ cluster, node, onOpenCluster, onApprove, onEditNode }: Props) {
  if (node && !node.ghost) {
    return (
      <aside className="inspector">
        <div className="inspector-head"><div><small>INSPECTOR</small><h3>Chi tiết node</h3></div></div>
        <div className="inspector-body">
          <h2 className="ins-title">{node.name}</h2>
          <span className={`status-chip ${node.status === 'Đã duyệt' ? 'ok' : 'warn'}`}>{node.status}</span>
          <div className="stat-grid">
            <div><b>{node.contents ?? 0}</b><small>tài nguyên</small></div>
            <div><b>{node.questions ?? 0}</b><small>câu kiểm tra</small></div>
          </div>
          <h4 className="sec">QUAN HỆ</h4>
          <div className="chip-row">
            <span className="chip">← {node.incoming ?? 0} cạnh vào</span>
            <span className="chip">{node.outgoing ?? 0} cạnh ra →</span>
          </div>
          <h4 className="sec">ĐÓNG GÓP CHUẨN ĐẦU RA</h4>
          <div className="chip-row">
            {(node.lo ?? []).map((l) => <span key={l} className="lo-chip x">{l} <X size={10} /></span>)}
            <button className="lo-chip add"><Plus size={10} /> Thêm LO</button>
          </div>
          <div className="ai-source"><Sparkles size={12} /><div><b>Nguồn AI</b><span>Đối chiếu đã cụm CO2003</span></div></div>
        </div>
        <div className="inspector-foot">
          <button className="btn btn-outline btn-block" onClick={() => onEditNode(node.id)}><Pencil size={12} /> Sửa</button>
        </div>
      </aside>
    );
  }
  if (cluster) {
    return (
      <aside className="inspector">
        <div className="inspector-head"><div><small>INSPECTOR</small><h3>Chi tiết cụm</h3></div></div>
        <div className="inspector-body">
          <h2 className="ins-title">{cluster.name}</h2>
          <span className={`status-chip ${cluster.approved ? 'ok' : 'warn'}`}>{cluster.approved ? 'Đã duyệt' : 'Chờ duyệt'}</span>
          <div className="stat-grid">
            <div><b>{cluster.nodeCount}</b><small>node</small></div>
            <div><b>{cluster.struggle}%</b><small>học viên khó khăn</small></div>
          </div>
          <h4 className="sec">ĐÓNG GÓP CHUẨN ĐẦU RA</h4>
          <div className="chip-row">{cluster.lo.map((l) => <span key={l} className="lo-chip">{l}</span>)}</div>
          {cluster.issue && <div className={`issue-box ${cluster.issue.level}`}>{cluster.issue.label}</div>}
        </div>
        <div className="inspector-foot">
          <button className="btn btn-primary btn-block" onClick={() => onOpenCluster(cluster.id)}><FolderOpen size={12} /> Mở cụm</button>
          {!cluster.approved && <button className="btn btn-outline btn-block" onClick={() => onApprove(cluster.id)}><CheckCircle2 size={12} /> Duyệt cụm</button>}
        </div>
      </aside>
    );
  }
  return (
    <aside className="inspector">
      <div className="inspector-head"><div><small>INSPECTOR</small><h3>Chi tiết</h3></div></div>
      <div className="inspector-empty">
        <span className="empty-ico"><Target size={18} /></span>
        <b>Chọn một cụm hoặc LO</b>
        <small>Thông tin tóm tắt sẽ xuất hiện tại đây.</small>
      </div>
    </aside>
  );
}

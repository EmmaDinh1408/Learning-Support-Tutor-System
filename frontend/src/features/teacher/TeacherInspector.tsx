import { BookOpen, FolderOpen, Pencil, Plus, Target, X, Sparkles, CheckCircle2 } from 'lucide-react';
import type { TeacherCluster, TeacherNode } from '../../types';
import { teacherNodeStatusLabel } from './statusLabels';

interface Props {
  courseName: string;
  cluster?: TeacherCluster | null;
  node?: TeacherNode | null;
  readOnly?: boolean;
  onOpenCluster: (id: string) => void;
  onApprove?: (id: string) => void;
  onEditNode?: (id: string) => void;
  onAddLo?: (nodeId: string, lo: string) => void;
  onRemoveLo?: (nodeId: string, lo: string) => void;
  onStartLearning?: () => void;
}

export function TeacherInspector({
  courseName,
  cluster,
  node,
  readOnly = false,
  onOpenCluster,
  onApprove,
  onEditNode,
  onAddLo,
  onRemoveLo,
  onStartLearning,
}: Props) {
  if (node && !node.ghost) {
    return (
      <aside className="inspector">
        <div className="inspector-head">
          <div>
            <small>{readOnly ? 'CHI TIẾT KIẾN THỨC' : 'INSPECTOR'}</small>
            <h3>Chi tiết node</h3>
          </div>
        </div>
        <div className="inspector-body">
          <h2 className="ins-title">{node.name}</h2>
          <span className={`status-chip ${node.status === 'approved' ? 'ok' : 'warn'}`}>
            {teacherNodeStatusLabel(node.status)}
          </span>
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
            {(node.lo ?? []).map((l) => (
              <span key={l} className={`lo-chip${readOnly ? '' : ' x'}`}>
                {l}
                {!readOnly && onRemoveLo && (
                  <button
                    type="button"
                    aria-label={`Xóa ${l}`}
                    style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', display: 'inline-flex', color: 'inherit' }}
                    onClick={() => onRemoveLo(node.id, l)}
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
            {!readOnly && onAddLo && (
              <button
                type="button"
                className="lo-chip add"
                onClick={() => {
                  const next = window.prompt('Nhập mã chuẩn đầu ra (VD: LO1, LO2):', 'LO1');
                  if (next?.trim()) onAddLo(node.id, next.trim().toUpperCase());
                }}
              >
                <Plus size={10} /> Thêm LO
              </button>
            )}
          </div>
          <div className="ai-source">
            <Sparkles size={12} />
            <div>
              <b>{readOnly ? 'Lộ trình môn học' : 'Nguồn AI'}</b>
              <span>Đối chiếu khóa học {courseName}</span>
            </div>
          </div>
        </div>
        <div className="inspector-foot">
          {readOnly ? (
            onStartLearning && (
              <button type="button" className="btn btn-primary btn-block" onClick={onStartLearning}>
                <BookOpen size={12} /> Mở nội dung học tập
              </button>
            )
          ) : (
            onEditNode && (
              <button type="button" className="btn btn-outline btn-block" onClick={() => onEditNode(node.id)}>
                <Pencil size={12} /> Sửa
              </button>
            )
          )}
        </div>
      </aside>
    );
  }
  if (cluster) {
    return (
      <aside className="inspector">
        <div className="inspector-head">
          <div>
            <small>{readOnly ? 'CỤM KIẾN THỨC' : 'INSPECTOR'}</small>
            <h3>Chi tiết cụm</h3>
          </div>
        </div>
        <div className="inspector-body">
          <h2 className="ins-title">{cluster.name}</h2>
          <span className={`status-chip ${cluster.approved ? 'ok' : 'warn'}`}>
            {cluster.approved ? 'Đã duyệt' : 'Chờ duyệt'}
          </span>
          <div className="stat-grid">
            <div><b>{cluster.nodeCount}</b><small>node</small></div>
            {!readOnly && <div><b>{cluster.struggle}%</b><small>học viên khó khăn</small></div>}
            {readOnly && <div><b>{cluster.lo.length}</b><small>chuẩn đầu ra</small></div>}
          </div>
          <h4 className="sec">ĐÓNG GÓP CHUẨN ĐẦU RA</h4>
          <div className="chip-row">{cluster.lo.map((l) => <span key={l} className="lo-chip">{l}</span>)}</div>
          {!readOnly && cluster.issue && <div className={`issue-box ${cluster.issue.level}`}>{cluster.issue.label}</div>}
        </div>
        <div className="inspector-foot">
          <button type="button" className="btn btn-primary btn-block" onClick={() => onOpenCluster(cluster.id)}>
            <FolderOpen size={12} /> Mở cụm
          </button>
          {!readOnly && !cluster.approved && onApprove && (
            <button type="button" className="btn btn-outline btn-block" onClick={() => onApprove(cluster.id)}>
              <CheckCircle2 size={12} /> Duyệt cụm
            </button>
          )}
        </div>
      </aside>
    );
  }
  return (
    <aside className="inspector">
      <div className="inspector-head">
        <div>
          <small>{readOnly ? 'THÔNG TIN' : 'INSPECTOR'}</small>
          <h3>Chi tiết</h3>
        </div>
      </div>
      <div className="inspector-empty">
        <span className="empty-ico"><Target size={18} /></span>
        <b>Chọn một cụm hoặc node</b>
        <small>
          {readOnly
            ? 'Nhấp vào cụm để xem chi tiết hoặc nhấp đúp để mở cụm kiến thức (chế độ chỉ xem).'
            : 'Thông tin tóm tắt và thao tác chỉnh sửa sẽ xuất hiện tại đây.'}
        </small>
      </div>
    </aside>
  );
}

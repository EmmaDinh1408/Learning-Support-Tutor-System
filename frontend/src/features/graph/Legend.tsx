interface Props {
  showRelated: boolean;
  onToggle: () => void;
  className?: string;
}

export function Legend({ showRelated, onToggle, className = '' }: Props) {
  return (
    <div className={`legend ${className}`}>
      <div className="legend-title">Chú giải</div>
      <div className="legend-row"><i className="ln ln-prereq" /> Tiên quyết (bắt buộc)</div>
      <div className="legend-row"><i className="ln ln-related" /> Liên quan</div>
      <div className="legend-row"><i className="ln ln-concept" /> Khái niệm cụm khác</div>
      <button className="legend-btn" onClick={onToggle}>{showRelated ? 'Ẩn liên quan' : 'Hiện liên quan'}</button>
    </div>
  );
}

export function LegendInline({ showRelated, onToggle }: Omit<Props, 'className'>) {
  return (
    <div className="legend-inline">
      <span><i className="ln ln-prereq" /> Tiên quyết (bắt buộc)</span>
      <span><i className="ln ln-related" /> Liên quan</span>
      <span><i className="ln ln-concept" /> Khái niệm cụm khác</span>
      <button className={`legend-btn ${showRelated ? 'on' : ''}`} onClick={onToggle}>
        {showRelated ? 'Ẩn liên quan' : 'Hiện liên quan'}
      </button>
    </div>
  );
}

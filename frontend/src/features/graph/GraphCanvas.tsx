import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EdgeKind } from '../../types';

export interface CanvasNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** khoảng thụt vào để cạnh nối vào mép nút tròn thay vì mép hộp */
  inset?: number;
}

export interface CanvasEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  dim?: boolean;
  active?: boolean;
}

interface Props {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  renderNode: (id: string) => ReactNode;
  /** đổi giá trị này để fit lại khung nhìn */
  fitKey?: string;
  padding?: number;
  maxScale?: number;
  onBackgroundClick?: () => void;
}

interface View { tx: number; ty: number; s: number }

export function GraphCanvas({ nodes, edges, renderNode, fitKey, padding = 48, maxScale = 1.25, onBackgroundClick }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ tx: 0, ty: 0, s: 1 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  const bounds = useMemo(() => {
    if (!nodes.length) return { x0: 0, y0: 0, x1: 100, y1: 100 };
    return {
      x0: Math.min(...nodes.map((n) => n.x)),
      y0: Math.min(...nodes.map((n) => n.y)),
      x1: Math.max(...nodes.map((n) => n.x + n.w)),
      y1: Math.max(...nodes.map((n) => n.y + n.h)),
    };
  }, [nodes]);

  const fit = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const cw = el.clientWidth, ch = el.clientHeight;
    const bw = bounds.x1 - bounds.x0, bh = bounds.y1 - bounds.y0;
    const s = Math.max(0.3, Math.min((cw - padding * 2) / bw, (ch - padding * 2) / bh, maxScale));
    setView({
      s,
      tx: (cw - bw * s) / 2 - bounds.x0 * s,
      ty: (ch - bh * s) / 2 - bounds.y0 * s,
    });
  }, [bounds, padding, maxScale]);

  useLayoutEffect(() => { fit(); }, [fit, fitKey]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  // zoom bằng con lăn (listener non-passive để chặn cuộn trang)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      setView((v) => {
        const s = Math.max(0.3, Math.min(2.2, v.s * (e.deltaY < 0 ? 1.1 : 0.9)));
        const k = s / v.s;
        return { s, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }));
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (d && !d.moved) onBackgroundClick?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const paths = edges.flatMap((e, i) => {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) return [];
    const x1 = a.x + a.w - (a.inset ?? 0), y1 = a.y + a.h / 2;
    const x2 = b.x + (b.inset ?? 0), y2 = b.y + b.h / 2;
    const dx = Math.max(22, Math.abs(x2 - x1) * 0.5);
    const d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
    return [{ d, e, key: `${e.from}-${e.to}-${i}` }];
  });

  return (
    <div className="graph-canvas" ref={wrap} onPointerDown={onPointerDown}>
      <div className="graph-layer" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` }}>
        <svg className="graph-edges" width={bounds.x1 + 400} height={bounds.y1 + 400} style={{ left: 0, top: 0 }}>
          {paths.map(({ d, e, key }) => (
            <path
              key={key}
              d={d}
              className={`edge edge-${e.kind}${e.dim ? ' dim' : ''}${e.active ? ' active' : ''}`}
            />
          ))}
        </svg>
        {nodes.map((n) => (
          <div key={n.id} data-node style={{ position: 'absolute', left: n.x, top: n.y, width: n.w, height: n.h }}>
            {renderNode(n.id)}
          </div>
        ))}
      </div>
    </div>
  );
}

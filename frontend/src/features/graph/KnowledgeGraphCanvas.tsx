import * as d3 from 'd3';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
  Link2,
  Maximize2,
  Merge,
  Minimize2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KnowledgeEdgeType, KnowledgeGraphData, KnowledgeNodeType } from '../../types';
import {
  buildGraphModel,
  computeVisibleGraph,
  DEFAULT_CHILD_PAGE_SIZE,
  EDGE_STYLES,
  edgeStyleOf,
  findAncestorPath,
  NODE_STYLES,
  nodeStyleOf,
  REVIEW_THRESHOLD,
  type NormalizedEdge,
  type NormalizedNode,
} from './graphHierarchy';

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  data: NormalizedNode;
  r: number;
  pinned?: boolean;
  iso?: boolean;
  isoIdx?: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  data: NormalizedEdge;
  source: SimNode;
  target: SimNode;
  offset?: number;
}

export interface KnowledgeGraphCanvasProps {
  courseId: string;
  data: KnowledgeGraphData;
  role: 'student' | 'teacher';
  editMode: boolean;
  rightOpen: boolean;
  onAddNode?: (input: { name: string; nodeType: KnowledgeNodeType; parentId?: string | null }) => Promise<void>;
  onAddEdge?: (input: { fromId: string; toId: string; kind: KnowledgeEdgeType }) => Promise<void>;
  onMergeNodes?: (input: { keepId: string; mergeId: string }) => Promise<void>;
  onDeleteNode?: (nodeId: string) => Promise<void>;
  onDeleteEdge?: (input: { fromId: string; toId: string; edgeType: string }) => Promise<void>;
  onApproveNode?: (nodeId: string) => Promise<void>;
  onApproveEdge?: (input: { fromId: string; toId: string; edgeType: string }) => Promise<void>;
  onOpenNodeEditor?: (nodeId: string) => void;
  onStartLearning?: () => void;
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxChars) cur = (cur + ' ' + w).trim();
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  const out = lines.slice(0, maxLines);
  if (lines.length > maxLines && out.length) {
    out[maxLines - 1] = out[maxLines - 1].replace(/.{0,2}$/, '') + '…';
  }
  return out.map((l) => (l.length > maxChars + 2 ? l.slice(0, maxChars) + '…' : l));
}

function parallelOffsets(list: SimLink[]) {
  const groups = new Map<string, SimLink[]>();
  for (const e of list) {
    const sid = e.source.id;
    const tid = e.target.id;
    const k = sid < tid ? `${sid}||${tid}` : `${tid}||${sid}`;
    const arr = groups.get(k);
    if (arr) arr.push(e);
    else groups.set(k, [e]);
  }
  groups.forEach((g) => {
    g.forEach((e, i) => {
      e.offset = (i - (g.length - 1) / 2) * 34;
    });
  });
}

function computeEdgeGeom(e: SimLink) {
  const s = e.source;
  const t = e.target;
  const sx = s.x ?? 0;
  const sy = s.y ?? 0;
  const tx = t.x ?? 0;
  const ty = t.y ?? 0;
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const sign = s.id < t.id ? 1 : -1;
  const c = (e.offset ?? 0) * sign * 2;
  const mx = (sx + tx) / 2 + nx * c;
  const my = (sy + ty) / 2 + ny * c;
  const style = edgeStyleOf(e.data.type);
  const tgtPad = style.arrow ? 4 : 1;

  let ux: number;
  let uy: number;
  let vx: number;
  let vy: number;
  if (c === 0) {
    ux = dx / len;
    uy = dy / len;
    vx = -ux;
    vy = -uy;
  } else {
    const l1 = Math.hypot(mx - sx, my - sy) || 1;
    ux = (mx - sx) / l1;
    uy = (my - sy) / l1;
    const l2 = Math.hypot(mx - tx, my - ty) || 1;
    vx = (mx - tx) / l2;
    vy = (my - ty) / l2;
  }

  const x1 = sx + ux * (s.r + 1);
  const y1 = sy + uy * (s.r + 1);
  const x2 = tx + vx * (t.r + tgtPad);
  const y2 = ty + vy * (t.r + tgtPad);
  const d = c === 0 ? `M${x1},${y1}L${x2},${y2}` : `M${x1},${y1}Q${mx},${my} ${x2},${y2}`;
  const lx = c === 0 ? (x1 + x2) / 2 : 0.25 * x1 + 0.5 * mx + 0.25 * x2;
  const ly = c === 0 ? (y1 + y2) / 2 : 0.25 * y1 + 0.5 * my + 0.25 * y2;
  let ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  if (ang > 90 || ang < -90) ang += 180;
  return { d, lx, ly, ang };
}

export function KnowledgeGraphCanvas({
  courseId,
  data,
  role,
  editMode,
  rightOpen,
  onAddNode,
  onAddEdge,
  onMergeNodes,
  onDeleteNode,
  onDeleteEdge,
  onApproveNode,
  onApproveEdge,
  onOpenNodeEditor,
  onStartLearning,
}: KnowledgeGraphCanvasProps) {
  const isTeacher = role === 'teacher';
  const showEditControls = isTeacher && editMode;

  const model = useMemo(() => buildGraphModel(data), [data]);

  // Progressive disclosure state
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pageLimits, setPageLimits] = useState<Map<string, number>>(() => new Map());
  const [hiddenNodeTypes, setHiddenNodeTypes] = useState<Set<string>>(() => new Set(['Content']));
  const [hiddenEdgeTypes, setHiddenEdgeTypes] = useState<Set<string>>(() => new Set());
  const [hideRedundant, setHideRedundant] = useState(true);
  const [orderMode, setOrderMode] = useState(false);
  const [focusReview, setFocusReview] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  selectedNodeIdRef.current = selectedNodeId;
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string; subtitle: string } | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [relayoutCounter, setRelayoutCounter] = useState(0);

  // Refs for persistent D3 simulation & node positions
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rootGRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const edgeGRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const nodeGRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const posMapRef = useRef<Map<string, SimNode>>(new Map());
  const autoFitRef = useRef<boolean>(true);
  const tickCountRef = useRef<number>(0);
  const hasMountedGraphRef = useRef<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Reset state cleanly when courseId changes
  useEffect(() => {
    setShowAll(false);
    setExpanded(new Set());
    setPageLimits(new Map());
    setHiddenNodeTypes(new Set(['Content']));
    setHiddenEdgeTypes(new Set());
    setFocusReview(false);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setQuery('');
    posMapRef.current.clear();
    autoFitRef.current = true;
    hasMountedGraphRef.current = false;
  }, [courseId]);

  const visible = useMemo(
    () =>
      computeVisibleGraph(model, {
        showAll,
        expanded,
        pageLimits,
        hiddenNodeTypes,
        hiddenEdgeTypes,
        hideRedundant,
      }),
    [model, showAll, expanded, pageLimits, hiddenNodeTypes, hiddenEdgeTypes, hideRedundant],
  );

  // Search across ALL nodes in the full AI graph (including currently hidden ones)
  const searchMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return model.nodes
      .filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.id.toLowerCase().includes(q) ||
          n.caption.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [model, query]);

  const matchIds = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.trim().toLowerCase();
    return new Set(
      model.nodes
        .filter(
          (n) =>
            n.name.toLowerCase().includes(q) ||
            n.id.toLowerCase().includes(q) ||
            n.caption.toLowerCase().includes(q),
        )
        .map((n) => n.id),
    );
  }, [model, query]);

  const reviewEdges = useMemo(() => model.edges.filter((e) => e.review), [model]);

  const revealNode = useCallback(
    (targetId: string) => {
      const target = model.byId.get(targetId);
      if (!target) return;
      if (hiddenNodeTypes.has(target.type)) {
        setHiddenNodeTypes((prev) => {
          const next = new Set(prev);
          next.delete(target.type);
          return next;
        });
      }
      if (!showAll && !model.roots.has(targetId)) {
        const path = findAncestorPath(model, targetId);
        if (path.length > 0) {
          setExpanded((prev) => {
            const next = new Set(prev);
            path.forEach((id) => next.add(id));
            return next;
          });
          // Ensure parent's pagination slice includes targetId and every intermediate node
          setPageLimits((prev) => {
            const next = new Map(prev);
            const fullChain = [...path, targetId];
            for (let i = 0; i < fullChain.length - 1; i++) {
              const p = fullChain[i];
              const c = fullChain[i + 1];
              const children = model.childrenOf.get(p) ?? [];
              const idx = children.indexOf(c);
              if (idx >= 0) {
                const needed = Math.ceil((idx + 1) / DEFAULT_CHILD_PAGE_SIZE) * DEFAULT_CHILD_PAGE_SIZE;
                const current = next.get(p) ?? DEFAULT_CHILD_PAGE_SIZE;
                if (needed > current) next.set(p, needed);
              }
            }
            return next;
          });
        }
      }
      setSelectedNodeId(targetId);
      setSelectedEdgeId(null);
      setPendingFocusId(targetId);
    },
    [model, hiddenNodeTypes, showAll],
  );

  const toggleExpandNode = useCallback(
    (nodeId: string) => {
      if (showAll) return;
      autoFitRef.current = false;
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
    },
    [showAll],
  );

  const loadMoreChildren = useCallback((parentId: string) => {
    autoFitRef.current = false;
    setPageLimits((prev) => {
      const next = new Map(prev);
      const cur = next.get(parentId) ?? DEFAULT_CHILD_PAGE_SIZE;
      next.set(parentId, cur + DEFAULT_CHILD_PAGE_SIZE);
      return next;
    });
  }, []);

  const handleExpandAll = () => {
    autoFitRef.current = true;
    tickCountRef.current = 0;
    setShowAll(true);
  };

  const handleCollapseAll = () => {
    autoFitRef.current = true;
    tickCountRef.current = 0;
    setShowAll(false);
    setExpanded(new Set());
    setPageLimits(new Map());
    setFocusReview(false);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  const handleToggleReviewFocus = () => {
    const nextFocus = !focusReview;
    setFocusReview(nextFocus);
    if (nextFocus && !showAll) {
      // Auto-expand ancestor chains to review edges (capped so UI stays smooth)
      const toExpand = new Set(expanded);
      const nextLimits = new Map(pageLimits);
      for (const e of reviewEdges.slice(0, 30)) {
        for (const endId of [e.sourceId, e.targetId]) {
          const path = findAncestorPath(model, endId);
          const chain = [...path, endId];
          path.forEach((id) => toExpand.add(id));
          for (let i = 0; i < chain.length - 1; i++) {
            const p = chain[i];
            const c = chain[i + 1];
            const idx = (model.childrenOf.get(p) ?? []).indexOf(c);
            if (idx >= 0) {
              const needed = Math.ceil((idx + 1) / DEFAULT_CHILD_PAGE_SIZE) * DEFAULT_CHILD_PAGE_SIZE;
              if (needed > (nextLimits.get(p) ?? DEFAULT_CHILD_PAGE_SIZE)) nextLimits.set(p, needed);
            }
          }
        }
      }
      autoFitRef.current = true;
      setExpanded(toExpand);
      setPageLimits(nextLimits);
    }
  };

  // Fit & Focus camera helpers
  const fitView = useCallback((animate = true) => {
    const svgEl = svgRef.current;
    const zoom = zoomRef.current;
    if (!svgEl || !zoom) return;
    const nodes = [...posMapRef.current.values()].filter(
      (n) => visible.nodes.some((vn) => vn.id === n.id) && typeof n.x === 'number' && typeof n.y === 'number',
    );
    if (!nodes.length) return;
    const x0 = d3.min(nodes, (n) => (n.x ?? 0) - n.r) ?? 0;
    const x1 = d3.max(nodes, (n) => (n.x ?? 0) + n.r) ?? 1;
    const y0 = d3.min(nodes, (n) => (n.y ?? 0) - n.r) ?? 0;
    const y1 = d3.max(nodes, (n) => (n.y ?? 0) + n.r) ?? 1;
    const rect = svgEl.getBoundingClientRect();
    const w = Math.max(rect.width, 320);
    const h = Math.max(rect.height, 240);
    const bw = Math.max(x1 - x0, 1);
    const bh = Math.max(y1 - y0, 1);
    const k = Math.min(1.25, 0.86 * Math.min(w / bw, h / bh));
    const tr = d3.zoomIdentity.translate(w / 2 - (k * (x0 + x1)) / 2, h / 2 - (k * (y0 + y1)) / 2).scale(k);
    const sel = d3.select(svgEl);
    if (animate) sel.transition().duration(420).call(zoom.transform, tr);
    else sel.call(zoom.transform, tr);
  }, [visible.nodes]);

  const focusOnNode = useCallback((nodeId: string) => {
    const svgEl = svgRef.current;
    const zoom = zoomRef.current;
    const simNode = posMapRef.current.get(nodeId);
    if (!svgEl || !zoom || !simNode || simNode.x === undefined || simNode.y === undefined) return;
    const rect = svgEl.getBoundingClientRect();
    const w = Math.max(rect.width, 320);
    const h = Math.max(rect.height, 240);
    const currentK = d3.zoomTransform(svgEl).k;
    const k = Math.max(0.95, Math.min(1.6, currentK));
    const tr = d3.zoomIdentity.translate(w / 2 - k * simNode.x, h / 2 - k * simNode.y).scale(k);
    autoFitRef.current = false;
    d3.select(svgEl).transition().duration(420).call(zoom.transform, tr);
  }, []);

  // Keyboard shortcuts: "/" to search, Escape to clear
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === '/' && document.activeElement !== searchInputRef.current) {
        const tag = (document.activeElement as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        ev.preventDefault();
        searchInputRef.current?.focus();
      }
      if (ev.key === 'Escape') {
        if (document.activeElement === searchInputRef.current) {
          setQuery('');
          searchInputRef.current?.blur();
        } else {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Initialize SVG layers, defs, zoom, and D3 force simulation once
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    Object.keys(EDGE_STYLES).forEach((type) => {
      defs
        .append('marker')
        .attr('id', `kg-ar-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 10)
        .attr('refY', 0)
        .attr('markerWidth', 9)
        .attr('markerHeight', 9)
        .attr('markerUnits', 'userSpaceOnUse')
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L10,0L0,4Z')
        .attr('fill', EDGE_STYLES[type].color);
    });

    const rootG = svg.append('g').attr('class', 'kg-root');
    const edgeG = rootG.append('g').attr('class', 'kg-edges');
    const nodeG = rootG.append('g').attr('class', 'kg-nodes');
    rootGRef.current = rootG;
    edgeGRef.current = edgeG;
    nodeGRef.current = nodeG;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.14, 4])
      .on('zoom', (ev) => {
        if (ev.sourceEvent) autoFitRef.current = false;
        rootG.attr('transform', ev.transform.toString());
        rootG.classed('kg-lowzoom', ev.transform.k < 0.62);
      });
    zoomRef.current = zoom;
    svg.call(zoom).on('dblclick.zoom', null);
    svg.on('click', () => {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    });

    const rect = svgEl.getBoundingClientRect();
    svg.call(zoom.transform, d3.zoomIdentity.translate(rect.width / 2, rect.height / 2));

    const sim = d3
      .forceSimulation<SimNode, SimLink>()
      .alphaDecay(0.032)
      .velocityDecay(0.4)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>()
          .id((d) => d.id)
          .distance((l) => edgeStyleOf(l.data.type).dist)
          .strength((l) => edgeStyleOf(l.data.type).str),
      )
      .force('charge', d3.forceManyBody<SimNode>().distanceMax(560))
      .force('collide', d3.forceCollide<SimNode>().radius((d) => d.r + 18).strength(0.95))
      .force('x', d3.forceX<SimNode>(0).strength(0.06))
      .force('y', d3.forceY<SimNode>(0).strength(0.08));

    simRef.current = sim;

    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, []);

  // Reconcile D3 DOM & simulation whenever visible graph / mode / selection / relayout changes
  useEffect(() => {
    const sim = simRef.current;
    const edgeG = edgeGRef.current;
    const nodeG = nodeGRef.current;
    if (!sim || !edgeG || !nodeG) return;

    const posMap = posMapRef.current;
    const siblingIndexByAnchor = new Map<string, number>();
    const siblingCountByAnchor = new Map<string, number>();

    visible.nodes.forEach((n) => {
      if (!posMap.has(n.id)) {
        const anchorId = visible.spawnAnchor.get(n.id) ?? '__root__';
        siblingCountByAnchor.set(anchorId, (siblingCountByAnchor.get(anchorId) ?? 0) + 1);
      }
    });

    const simNodes: SimNode[] = visible.nodes.map((n, index) => {
      const existing = posMap.get(n.id);
      if (existing) {
        existing.data = n;
        existing.r = n.r;
        return existing;
      }

      const anchorId = visible.spawnAnchor.get(n.id);
      const anchorNode = anchorId ? posMap.get(anchorId) : undefined;
      const key = anchorId ?? '__root__';
      const idx = siblingIndexByAnchor.get(key) ?? 0;
      siblingIndexByAnchor.set(key, idx + 1);
      const total = Math.max(siblingCountByAnchor.get(key) ?? 1, 1);

      let x = 0;
      let y = 0;
      if (anchorNode && anchorNode.x !== undefined && anchorNode.y !== undefined) {
        const angle = (Math.PI * 2 * idx) / total - Math.PI / 2;
        const rad = 105 + Math.min(total * 4, 65);
        x = anchorNode.x + Math.cos(angle) * rad;
        y = anchorNode.y + Math.sin(angle) * rad;
      } else if (n.type === 'Course') {
        x = 0;
        y = 0;
      } else {
        const angle = (Math.PI * 2 * index) / Math.max(visible.nodes.length, 1) - Math.PI / 2;
        const rad = 190 + (index % 2) * 30;
        x = Math.cos(angle) * rad;
        y = Math.sin(angle) * rad;
      }

      const created: SimNode = { id: n.id, data: n, r: n.r, x, y };
      posMap.set(n.id, created);
      return created;
    });

    const nodeById = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SimLink[] = [];
    for (const e of visible.edges) {
      const s = nodeById.get(e.sourceId);
      const t = nodeById.get(e.targetId);
      if (!s || !t) continue;
      simLinks.push({ id: e.id, data: e, source: s, target: t });
    }
    parallelOffsets(simLinks);

    // ---- Edges join ----
    const eSel = edgeG.selectAll<SVGGElement, SimLink>('g.kg-edge').data(simLinks, (d) => d.id);
    eSel.exit().remove();
    const eEnter = eSel.enter().append('g').attr('class', 'kg-edge');
    eEnter.append('path').attr('class', 'kg-halo');
    eEnter.append('path').attr('class', 'kg-line');
    eEnter.append('path').attr('class', 'kg-hit');
    eEnter.append('text').attr('class', 'kg-elabel').attr('text-anchor', 'middle').attr('dy', -4);

    const eAll = eEnter.merge(eSel);
    eAll
      .on('click', (ev, d) => {
        ev.stopPropagation();
        if (d.data.type === 'MORE') return;
        setSelectedEdgeId(d.id);
        setSelectedNodeId(null);
      })
      .on('mousemove', (ev, d) => {
        if (d.data.type === 'MORE') return;
        const conf = typeof d.data.props.confidence === 'number' ? ` · độ tin cậy ${d.data.props.confidence}` : '';
        setTooltip({
          x: ev.clientX,
          y: ev.clientY,
          title: `${edgeStyleOf(d.data.type).vi} (${d.data.type})`,
          subtitle: `${d.source.data.name} → ${d.target.data.name}${conf}`,
        });
      })
      .on('mouseleave', () => setTooltip(null));

    eAll
      .select<SVGPathElement>('.kg-line')
      .attr('stroke', (d) => edgeStyleOf(d.data.type).color)
      .attr('stroke-width', (d) => edgeStyleOf(d.data.type).w)
      .attr('stroke-dasharray', (d) => edgeStyleOf(d.data.type).dash || null)
      .attr('marker-end', (d) => (edgeStyleOf(d.data.type).arrow ? `url(#kg-ar-${d.data.type})` : null));

    eAll
      .select<SVGPathElement>('.kg-halo')
      .attr('stroke-width', (d) => edgeStyleOf(d.data.type).w + 7)
      .style('display', (d) => (isTeacher && d.data.review ? null : 'none'));

    eAll
      .select<SVGTextElement>('.kg-elabel')
      .attr('fill', (d) => edgeStyleOf(d.data.type).color)
      .text((d) => (d.data.type === 'EXPLAIN' || d.data.type === 'MORE' ? '' : d.data.type));

    // ---- Nodes join ----
    const nSel = nodeG.selectAll<SVGGElement, SimNode>('g.kg-node').data(simNodes, (d) => d.id);
    nSel.exit().remove();

    const nEnter = nSel
      .enter()
      .append('g')
      .attr('class', (d) => `kg-node${d.data.type === 'Content' ? ' kg-content' : ''}${d.data.isVirtualMore ? ' kg-more' : ''}`);

    nEnter.append('circle').attr('class', 'kg-ring');
    nEnter.append('circle').attr('class', 'kg-body');
    nEnter.append('circle').attr('class', 'kg-pin').attr('r', 4.5);
    nEnter.append('circle').attr('class', 'kg-review-dot').attr('r', 5.5);
    nEnter.append('text').attr('class', 'kg-label');

    // Expand / collapse badge (+N or −)
    const badgeG = nEnter.append('g').attr('class', 'kg-badge');
    badgeG.append('rect').attr('class', 'kg-badge-bg').attr('rx', 9).attr('ry', 9).attr('height', 18);
    badgeG.append('text').attr('class', 'kg-badge-txt').attr('text-anchor', 'middle').attr('dy', '0.35em');

    const nAll = nEnter.merge(nSel);

    nAll
      .select<SVGCircleElement>('.kg-ring')
      .attr('r', (d) => d.r + 5)
      .attr('stroke', (d) => nodeStyleOf(d.data.type).fill);

    nAll
      .select<SVGCircleElement>('.kg-body')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => nodeStyleOf(d.data.type).fill)
      .attr('stroke', (d) => nodeStyleOf(d.data.type).stroke)
      .attr('stroke-dasharray', (d) => (d.data.isVirtualMore ? '4 3' : null));

    nAll
      .select<SVGCircleElement>('.kg-pin')
      .attr('cx', (d) => d.r * 0.72)
      .attr('cy', (d) => -d.r * 0.72)
      .style('display', (d) => (d.pinned ? null : 'none'));

    // Teacher orange indicator dot when collapsed branch has hidden review items (or node itself needs review)
    nAll
      .select<SVGCircleElement>('.kg-review-dot')
      .attr('cx', (d) => -d.r * 0.72)
      .attr('cy', (d) => -d.r * 0.72)
      .style('display', (d) => {
        if (!isTeacher || d.data.isVirtualMore) return 'none';
        const hiddenChildren = visible.hiddenChildCount.get(d.id) ?? 0;
        const hiddenReview = model.reviewDescendantCount.get(d.id) ?? 0;
        return d.data.needsReview || (hiddenChildren > 0 && hiddenReview > 0) ? null : 'none';
      });

    nAll.select<SVGTextElement>('.kg-label').each(function (d) {
      const el = d3.select(this);
      el.selectAll('*').remove();
      const lines = wrapLines(d.data.caption, d.data.type === 'Concept' ? 12 : 11, 3);
      lines.forEach((line, i) => {
        el.append('tspan')
          .attr('x', 0)
          .attr('dy', i === 0 ? `${-(lines.length - 1) * 0.55 + 0.35}em` : '1.1em')
          .text(line);
      });
    });

    // Update +N / − badge per node
    nAll.select<SVGGElement>('.kg-badge').each(function (d) {
      const g = d3.select(this);
      if (d.data.isVirtualMore || showAll) {
        g.style('display', 'none');
        return;
      }
      const hidden = visible.hiddenChildCount.get(d.id) ?? 0;
      const totalEligible = visible.expandableCount.get(d.id) ?? 0;
      const isExp = expanded.has(d.id);

      if (hidden > 0) {
        const label = `+${hidden}`;
        const w = Math.max(22, label.length * 7 + 10);
        g.style('display', null)
          .classed('expanded', false)
          .attr('transform', `translate(${d.r * 0.68}, ${d.r * 0.68})`);
        g.select('rect').attr('x', -w / 2).attr('y', -9).attr('width', w);
        g.select('text').text(label);
      } else if (isExp && totalEligible > 0) {
        g.style('display', null)
          .classed('expanded', true)
          .attr('transform', `translate(${d.r * 0.68}, ${d.r * 0.68})`);
        g.select('rect').attr('x', -10).attr('y', -9).attr('width', 20);
        g.select('text').text('−');
      } else {
        g.style('display', 'none');
      }
    });

    // Separate click on +N / − badge (always toggles expand/collapse immediately; stop mousedown so drag never intercepts)
    nAll
      .select<SVGGElement>('.kg-badge')
      .on('mousedown', (ev) => {
        ev.stopPropagation();
      })
      .on('click', (ev, d) => {
        ev.stopPropagation();
        toggleExpandNode(d.id);
      });

    // Click on node body: selects node AND expands if collapsed (or collapses if already selected & expanded)
    nAll
      .on('click', (ev, d) => {
        ev.stopPropagation();
        if (d.data.isVirtualMore && d.data.moreParentId) {
          loadMoreChildren(d.data.moreParentId);
          return;
        }
        const canExpand = !showAll && (visible.expandableCount.get(d.id) ?? 0) > 0;
        const hiddenCount = visible.hiddenChildCount.get(d.id) ?? 0;
        if (canExpand) {
          if (hiddenCount > 0 && !expanded.has(d.id)) {
            toggleExpandNode(d.id);
          } else if (expanded.has(d.id) && selectedNodeIdRef.current === d.id) {
            toggleExpandNode(d.id);
          }
        }
        setSelectedNodeId(d.id);
        setSelectedEdgeId(null);
      })
      .on('dblclick', (ev, d) => {
        ev.stopPropagation();
        if (d.data.isVirtualMore && d.data.moreParentId) {
          loadMoreChildren(d.data.moreParentId);
          return;
        }
        if (isTeacher && d.pinned) {
          d.fx = null;
          d.fy = null;
          d.pinned = false;
          sim.alpha(0.28).restart();
          return;
        }
        toggleExpandNode(d.id);
      })
      .on('mousemove', (ev, d) => {
        const hidden = visible.hiddenChildCount.get(d.id) ?? 0;
        const hiddenRev = isTeacher ? (model.reviewDescendantCount.get(d.id) ?? 0) : 0;
        const parts = [nodeStyleOf(d.data.type).vi];
        if (!d.data.isVirtualMore && !showAll && hidden > 0) {
          parts.push(`+${hidden} nút con ẩn (bấm vào nút để mở)`);
        } else if (!d.data.isVirtualMore && !showAll && expanded.has(d.id)) {
          parts.push('đang mở (bấm lại hoặc bấm − để thu gọn)');
        }
        if (isTeacher && hidden > 0 && hiddenRev > 0) {
          parts.push(`${hiddenRev} mục cần duyệt bên trong`);
        }
        setTooltip({
          x: ev.clientX,
          y: ev.clientY,
          title: d.data.name,
          subtitle: parts.join(' · '),
        });
      })
      .on('mouseleave', () => setTooltip(null));

    // Teacher drag-to-pin with 4px movement threshold so clicks are never swallowed by drag
    if (isTeacher) {
      let dragMoved = false;
      let startX = 0;
      let startY = 0;
      nAll.call(
        d3
          .drag<SVGGElement, SimNode>()
          .filter((ev) => {
            const target = ev.target as Element | null;
            if (target?.closest('.kg-badge')) return false;
            return !ev.ctrlKey && !ev.button;
          })
          .on('start', (ev, d) => {
            dragMoved = false;
            startX = ev.x;
            startY = ev.y;
            setTooltip(null);
            if (d.pinned) {
              d.fx = d.x;
              d.fy = d.y;
            }
          })
          .on('drag', (ev, d) => {
            if (!dragMoved && Math.hypot(ev.x - startX, ev.y - startY) < 4) return;
            if (!dragMoved) {
              dragMoved = true;
              if (!ev.active) sim.alphaTarget(0.22).restart();
            }
            d.fx = ev.x;
            d.fy = ev.y;
          })
          .on('end', (ev, d) => {
            if (dragMoved) {
              if (!ev.active) sim.alphaTarget(0);
              d.pinned = true;
              nAll.select<SVGCircleElement>('.kg-pin').style('display', (item) => (item.pinned ? null : 'none'));
            }
          }),
      );
    } else {
      nAll.on('.drag', null);
    }

    // ---- Forces & Order mode ----
    const deg = new Map<string, number>();
    simLinks.forEach((e) => {
      deg.set(e.source.id, (deg.get(e.source.id) ?? 0) + 1);
      deg.set(e.target.id, (deg.get(e.target.id) ?? 0) + 1);
    });
    const isoNodes = simNodes.filter((n) => !deg.get(n.id));
    simNodes.forEach((n) => {
      n.iso = false;
    });
    isoNodes.forEach((n, i) => {
      n.iso = true;
      n.isoIdx = i;
    });
    const perRow = 8;
    const step = 175;
    const half = ((model.maxConceptDepth + 2) * step) / 2;

    sim.force(
      'x',
      d3
        .forceX<SimNode>((d) =>
          d.iso
            ? (((d.isoIdx ?? 0) % perRow) - (Math.min(isoNodes.length, perRow) - 1) / 2) * 84
            : orderMode && d.data.type !== 'Content'
              ? (model.depth.get(d.id) ?? 0) * step - half
              : 0,
        )
        .strength((d) => (d.iso ? 0.45 : orderMode ? (d.data.type === 'Content' ? 0.02 : 0.32) : 0.06)),
    );
    sim.force(
      'y',
      d3
        .forceY<SimNode>((d) => (d.iso ? 300 + Math.floor((d.isoIdx ?? 0) / perRow) * 84 : 0))
        .strength((d) => (d.iso ? 0.35 : orderMode ? 0.07 : 0.08)),
    );
    (sim.force('charge') as d3.ForceManyBody<SimNode>).strength((d) =>
      d.iso ? -30 : d.data.type === 'Content' ? -45 : d.data.isVirtualMore ? -140 : -380,
    );

    const ticked = () => {
      if (autoFitRef.current && ++tickCountRef.current % 20 === 0) {
        fitView(false);
      }
      eAll.each(function (e) {
        const g = computeEdgeGeom(e);
        const el = d3.select(this);
        el.select('.kg-line').attr('d', g.d);
        el.select('.kg-hit').attr('d', g.d);
        el.select('.kg-halo').attr('d', g.d);
        el.select('.kg-elabel').attr('transform', `translate(${g.lx},${g.ly}) rotate(${g.ang})`);
      });
      nAll.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    };

    sim.on('tick', ticked);
    sim.on('end', () => {
      if (autoFitRef.current) fitView(true);
    });

    sim.nodes(simNodes);
    (sim.force('link') as d3.ForceLink<SimNode, SimLink>).links(simLinks);

    // Gentle alpha when expanding/collapsing so existing graph doesn't jump; stronger alpha on first load/relayout
    const alpha = !hasMountedGraphRef.current || relayoutCounter > 0 ? 0.85 : 0.32;
    hasMountedGraphRef.current = true;
    sim.alpha(alpha).restart();
    ticked();
  }, [visible, model, isTeacher, orderMode, showAll, expanded, relayoutCounter, fitView, toggleExpandNode, loadMoreChildren]);

  // Apply selection / search / review dimming without restarting simulation
  useEffect(() => {
    const edgeG = edgeGRef.current;
    const nodeG = nodeGRef.current;
    if (!edgeG || !nodeG) return;

    let ns: Set<string> | null = null;
    let es: Set<string> | null = null;

    if (selectedNodeId) {
      ns = new Set([selectedNodeId]);
      es = new Set();
      for (const e of visible.edges) {
        if (e.sourceId === selectedNodeId || e.targetId === selectedNodeId) {
          es.add(e.id);
          ns.add(e.sourceId);
          ns.add(e.targetId);
        }
      }
    } else if (selectedEdgeId) {
      const edge = visible.edges.find((e) => e.id === selectedEdgeId);
      if (edge) {
        ns = new Set([edge.sourceId, edge.targetId]);
        es = new Set([edge.id]);
      }
    } else if (matchIds) {
      ns = matchIds;
      es = new Set();
      for (const e of visible.edges) {
        if (ns.has(e.sourceId) || ns.has(e.targetId)) es.add(e.id);
      }
    } else if (focusReview && isTeacher) {
      ns = new Set();
      es = new Set();
      for (const e of visible.edges) {
        if (e.review) {
          es.add(e.id);
          ns.add(e.sourceId);
          ns.add(e.targetId);
        }
      }
    }

    const selEdgeObj = selectedEdgeId ? visible.edges.find((e) => e.id === selectedEdgeId) : null;

    nodeG
      .selectAll<SVGGElement, SimNode>('g.kg-node')
      .classed('kg-dim', (d) => Boolean(ns && !ns.has(d.id)))
      .classed(
        'kg-sel',
        (d) =>
          d.id === selectedNodeId ||
          Boolean(selEdgeObj && (d.id === selEdgeObj.sourceId || d.id === selEdgeObj.targetId)),
      );

    edgeG
      .selectAll<SVGGElement, SimLink>('g.kg-edge')
      .classed('kg-dim', (d) => Boolean(es && !es.has(d.id)))
      .classed('kg-edge-sel', (d) => d.id === selectedEdgeId);
  }, [selectedNodeId, selectedEdgeId, matchIds, focusReview, isTeacher, visible]);

  // Smoothly focus camera when a hidden node was just auto-expanded via search / inspector
  useEffect(() => {
    if (!pendingFocusId) return;
    const timer = window.setTimeout(() => {
      focusOnNode(pendingFocusId);
      setPendingFocusId(null);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [pendingFocusId, visible, focusOnNode]);

  const selectedNode = selectedNodeId ? model.byId.get(selectedNodeId) ?? null : null;
  const selectedEdge = selectedEdgeId ? model.edges.find((e) => e.id === selectedEdgeId) ?? null : null;

  // Group all relationships of selected node (including hidden neighbors — clicking them auto-expands!)
  const selectedNodeRelations = useMemo(() => {
    if (!selectedNode) return [];
    const grouped = new Map<string, { edge: NormalizedEdge; out: boolean; other: NormalizedNode }[]>();
    for (const e of model.edges) {
      if (e.sourceId !== selectedNode.id && e.targetId !== selectedNode.id) continue;
      const out = e.sourceId === selectedNode.id;
      const other = model.byId.get(out ? e.targetId : e.sourceId);
      if (!other) continue;
      const list = grouped.get(e.type) ?? [];
      list.push({ edge: e, out, other });
      grouped.set(e.type, list);
    }
    return Object.keys(EDGE_STYLES)
      .filter((t) => grouped.has(t))
      .map((type) => ({ type, items: grouped.get(type)! }));
  }, [model, selectedNode]);

  // Available types present in the current AI graph
  const presentNodeTypes = useMemo(
    () => Object.keys(NODE_STYLES).filter((t) => t !== 'More' && model.nodes.some((n) => n.type === t)),
    [model],
  );
  const presentEdgeTypes = useMemo(
    () => Object.keys(EDGE_STYLES).filter((t) => t !== 'MORE' && model.edges.some((e) => e.type === t)),
    [model],
  );

  // Teacher editing triggers
  const triggerAddNode = async () => {
    if (!showEditControls || !onAddNode) return;
    const name = window.prompt('Tên nút kiến thức mới:');
    if (!name?.trim()) return;
    const rawType = window.prompt('Loại nút (Concept, LO, Assignment, Item, Content):', 'Concept') ?? 'Concept';
    const allowed: KnowledgeNodeType[] = ['Concept', 'LO', 'Assignment', 'Item', 'Content'];
    const nodeType = allowed.includes(rawType.trim()) ? rawType.trim() : 'Concept';
    await onAddNode({ name: name.trim(), nodeType, parentId: selectedNodeId });
  };

  const triggerAddEdge = async () => {
    if (!showEditControls || !onAddEdge) return;
    const fromId = window.prompt('ID nút nguồn:', selectedNodeId ?? '');
    if (!fromId?.trim()) return;
    const toId = window.prompt('ID nút đích:');
    if (!toId?.trim()) return;
    const rawKind =
      window.prompt('Loại quan hệ (PREREQUISITE, PART_OF, RELATED_TO, DEVELOP, ASSESS, EXPLAIN):', 'PREREQUISITE') ??
      'PREREQUISITE';
    await onAddEdge({ fromId: fromId.trim(), toId: toId.trim(), kind: rawKind.trim().toUpperCase() });
  };

  const triggerMergeNodes = async () => {
    if (!showEditControls || !onMergeNodes) return;
    const keepId = window.prompt('ID nút giữ lại:', selectedNodeId ?? '');
    if (!keepId?.trim()) return;
    const mergeId = window.prompt(`ID nút cần gộp vào "${keepId.trim()}":`);
    if (!mergeId?.trim() || mergeId.trim() === keepId.trim()) return;
    await onMergeNodes({ keepId: keepId.trim(), mergeId: mergeId.trim() });
    setSelectedNodeId(keepId.trim());
  };

  const triggerDeleteSelected = async () => {
    if (!showEditControls) return;
    if (selectedEdge && onDeleteEdge) {
      if (!window.confirm(`Xóa quan hệ ${selectedEdge.type} giữa ${selectedEdge.sourceId} → ${selectedEdge.targetId}?`)) {
        return;
      }
      await onDeleteEdge({
        fromId: selectedEdge.sourceId,
        toId: selectedEdge.targetId,
        edgeType: selectedEdge.type,
      });
      setSelectedEdgeId(null);
      return;
    }
    if (selectedNode && onDeleteNode) {
      if (selectedNode.type === 'Course') {
        window.alert('Không thể xóa nút gốc của môn học.');
        return;
      }
      if (!window.confirm(`Xóa nút "${selectedNode.name}" và các quan hệ liên quan?`)) return;
      await onDeleteNode(selectedNode.id);
      setSelectedNodeId(null);
    }
  };

  const handleRelayout = () => {
    posMapRef.current.forEach((n) => {
      n.fx = null;
      n.fy = null;
      n.pinned = false;
    });
    autoFitRef.current = true;
    tickCountRef.current = 0;
    setRelayoutCounter((c) => c + 1);
  };

  const visibleRealNodeCount = visible.nodes.filter((n) => !n.isVirtualMore).length;
  const visibleRealEdgeCount = visible.edges.filter((e) => e.type !== 'MORE').length;
  const hiddenTotalCount = Math.max(0, model.nodes.filter((n) => !hiddenNodeTypes.has(n.type)).length - visibleRealNodeCount);

  return (
    <div className="kg-shell">
      {/* Top Control Header */}
      <div className="kg-header">
        <div className="kg-search-wrap">
          <Search size={13} className="kg-search-ico" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchMatches.length > 0) {
                revealNode(searchMatches[0].id);
                setSearchFocused(false);
              }
            }}
            placeholder="Tìm khái niệm, LO, bài tập… ( / )"
          />
          {searchFocused && query.trim() && (
            <div className="kg-search-dropdown">
              {searchMatches.length === 0 ? (
                <div className="kg-search-empty">Không tìm thấy nút phù hợp</div>
              ) : (
                searchMatches.map((item) => {
                  const isVis = visible.nodes.some((vn) => vn.id === item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="kg-search-item"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        revealNode(item.id);
                        setSearchFocused(false);
                      }}
                    >
                      <span className="kg-dot" style={{ background: nodeStyleOf(item.type).fill }} />
                      <span className="kg-search-name">{item.name}</span>
                      <span className="kg-search-meta">
                        {item.type}
                        {!isVis ? ' · tự mở đường' : ''}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <label className="kg-ctl">
          <input type="checkbox" checked={orderMode} onChange={(e) => setOrderMode(e.target.checked)} />
          Theo thứ tự học
        </label>
        <label className="kg-ctl">
          <input type="checkbox" checked={hideRedundant} onChange={(e) => setHideRedundant(e.target.checked)} />
          Ẩn cạnh dư
        </label>

        <div className="kg-mode-btns">
          {showAll ? (
            <button type="button" className="kg-btn" onClick={handleCollapseAll} title="Thu gọn về các nút bậc 1">
              <Minimize2 size={12} /> Thu gọn về gốc
            </button>
          ) : (
            <button type="button" className="kg-btn" onClick={handleExpandAll} title="Hiển thị toàn bộ đồ thị">
              <Maximize2 size={12} /> Mở tất cả
            </button>
          )}
          <button type="button" className="kg-btn" onClick={handleRelayout} title="Bỏ ghim và sắp xếp lại">
            <RotateCcw size={12} /> Sắp xếp lại
          </button>
        </div>

        <div className="kg-spacer" />

        {showEditControls ? (
          <div className="kg-edit-bar">
            <button type="button" className="kg-btn" onClick={() => void triggerAddNode()}>
              <Plus size={12} /> Thêm nút
            </button>
            <button type="button" className="kg-btn" onClick={() => void triggerAddEdge()}>
              <Link2 size={12} /> Nối cạnh
            </button>
            <button type="button" className="kg-btn" onClick={() => void triggerMergeNodes()}>
              <Merge size={12} /> Gộp nút
            </button>
            <button
              type="button"
              className="kg-btn danger"
              disabled={!selectedNode && !selectedEdge}
              onClick={() => void triggerDeleteSelected()}
            >
              <Trash2 size={12} /> Xóa đã chọn
            </button>
          </div>
        ) : !isTeacher ? (
          <span className="kg-readonly-pill">
            <Eye size={12} /> Chế độ chỉ xem
          </span>
        ) : null}
      </div>

      {/* Node & Relation Type Chips */}
      <div className="kg-overview">
        <div className="kg-chip-row">
          <span className="kg-chip-lbl">Loại nút</span>
          <div className="kg-chips">
            {presentNodeTypes.map((type) => {
              const total = model.nodes.filter((n) => n.type === type).length;
              const visCount = visible.nodes.filter((n) => n.type === type).length;
              const off = hiddenNodeTypes.has(type);
              const style = nodeStyleOf(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={`kg-pill${off ? ' off' : ''}`}
                  style={off ? undefined : { background: style.fill, borderColor: style.stroke }}
                  title={`${style.vi} · bấm để ẩn/hiện`}
                  onClick={() => {
                    setHiddenNodeTypes((prev) => {
                      const next = new Set(prev);
                      if (next.has(type)) next.delete(type);
                      else next.add(type);
                      return next;
                    });
                  }}
                >
                  {type} <small>{off ? total : visCount === total ? total : `${visCount}/${total}`}</small>
                </button>
              );
            })}
          </div>
        </div>
        <div className="kg-chip-row">
          <span className="kg-chip-lbl">Loại quan hệ</span>
          <div className="kg-chips">
            {presentEdgeTypes.map((type) => {
              const total = model.edges.filter((e) => e.type === type).length;
              const visCount = visible.edges.filter((e) => e.type === type).length;
              const off = hiddenEdgeTypes.has(type);
              const style = edgeStyleOf(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={`kg-pill rchip${off ? ' off' : ''}`}
                  style={off ? undefined : { color: style.color, borderColor: style.color }}
                  title={`${style.vi} · bấm để ẩn/hiện`}
                  onClick={() => {
                    setHiddenEdgeTypes((prev) => {
                      const next = new Set(prev);
                      if (next.has(type)) next.delete(type);
                      else next.add(type);
                      return next;
                    });
                  }}
                >
                  <i className={`${style.dash ? 'dash ' : ''}${style.arrow ? 'arrow' : ''}`} />
                  {type} <small>{off ? total : visCount === total ? total : `${visCount}/${total}`}</small>
                </button>
              );
            })}
            {isTeacher && reviewEdges.length > 0 && (
              <button
                type="button"
                className={`kg-pill review${focusReview ? ' on' : ''}`}
                title={`Quan hệ do AI đề xuất có độ tin cậy < ${REVIEW_THRESHOLD} hoặc chưa duyệt · bấm để tự mở & làm nổi`}
                onClick={handleToggleReviewFocus}
              >
                Cần duyệt <small>{reviewEdges.length}</small>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Stage + Right Inspector */}
      <div className="kg-main">
        <div className="kg-stage">
          <svg ref={svgRef} className="kg-svg" />

          <div className="kg-zoom">
            <button
              type="button"
              className="kg-btn"
              title="Phóng to"
              onClick={() => {
                if (svgRef.current && zoomRef.current) {
                  d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, 1.35);
                }
              }}
            >
              +
            </button>
            <button
              type="button"
              className="kg-btn"
              title="Thu nhỏ"
              onClick={() => {
                if (svgRef.current && zoomRef.current) {
                  d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, 1 / 1.35);
                }
              }}
            >
              −
            </button>
            <button type="button" className="kg-btn" title="Vừa khung" onClick={() => fitView(true)}>
              Fit
            </button>
          </div>

          <div className="kg-status">
            Đang hiển thị <b>{visibleRealNodeCount}</b> nút · <b>{visibleRealEdgeCount}</b> quan hệ
            {!showAll && hiddenTotalCount > 0 ? ` · còn ${hiddenTotalCount} nút ẩn (bấm +N trên nút để mở)` : ''}
          </div>
        </div>

        {rightOpen && (
          <aside className="kg-panel">
            {selectedNode ? (
              <>
                <div className="kg-panel-head">
                  <h2>Thuộc tính nút</h2>
                  {!showAll && (visible.expandableCount.get(selectedNode.id) ?? 0) > 0 && (
                    <button
                      type="button"
                      className="kg-btn sm"
                      onClick={() => toggleExpandNode(selectedNode.id)}
                    >
                      {expanded.has(selectedNode.id) ? (
                        <>
                          <ChevronDown size={12} /> Thu gọn
                        </>
                      ) : (
                        <>
                          <ChevronRight size={12} /> Mở rộng (+{visible.hiddenChildCount.get(selectedNode.id) ?? 0})
                        </>
                      )}
                    </button>
                  )}
                </div>

                <span className="kg-tag" style={{ background: nodeStyleOf(selectedNode.type).fill }}>
                  {selectedNode.type}
                </span>
                <div className="kg-title">{selectedNode.name}</div>

                {isTeacher && selectedNode.needsReview && (
                  <div className="kg-warn">
                    Khái niệm do AI đề xuất (chưa xác nhận). Giảng viên có thể duyệt hoặc chỉnh sửa.
                  </div>
                )}

                <div className="kg-panel-actions">
                  {showEditControls && selectedNode.needsReview && onApproveNode && (
                    <button
                      type="button"
                      className="btn btn-primary sm"
                      onClick={() => void onApproveNode(selectedNode.id)}
                    >
                      <CheckCircle2 size={12} /> Duyệt nút
                    </button>
                  )}
                  {showEditControls && selectedNode.type !== 'Course' && onOpenNodeEditor && (
                    <button
                      type="button"
                      className="btn btn-outline sm"
                      onClick={() => onOpenNodeEditor(selectedNode.id)}
                    >
                      <Edit3 size={12} /> Sửa chi tiết
                    </button>
                  )}
                  {!isTeacher && onStartLearning && (
                    <button type="button" className="btn btn-primary sm" onClick={onStartLearning}>
                      Mở tài liệu môn học
                    </button>
                  )}
                </div>

                <table className="kg-props">
                  <tbody>
                    <tr>
                      <td>&lt;id&gt;</td>
                      <td>{selectedNode.id}</td>
                    </tr>
                    {selectedNode.description && (
                      <tr>
                        <td>mô tả</td>
                        <td>{selectedNode.description}</td>
                      </tr>
                    )}
                    {Boolean(selectedNode.props.chapter_id) && (
                      <tr>
                        <td>chương</td>
                        <td>{String(selectedNode.props.chapter_id)}</td>
                      </tr>
                    )}
                    {Boolean(selectedNode.props.page) && (
                      <tr>
                        <td>trang</td>
                        <td>{String(selectedNode.props.page)}</td>
                      </tr>
                    )}
                    {Boolean(selectedNode.props.code) && (
                      <tr>
                        <td>mã</td>
                        <td>{String(selectedNode.props.code)}</td>
                      </tr>
                    )}
                    {Boolean(selectedNode.props.status) && (
                      <tr>
                        <td>trạng thái</td>
                        <td>{String(selectedNode.props.status)}</td>
                      </tr>
                    )}
                    {Array.isArray(selectedNode.props.merged_from) && selectedNode.props.merged_from.length > 0 && (
                      <tr>
                        <td>đã gộp từ</td>
                        <td>{(selectedNode.props.merged_from as string[]).join(', ')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="kg-rels">
                  {selectedNodeRelations.map(({ type, items }) => {
                    const style = edgeStyleOf(type);
                    const limit = type === 'EXPLAIN' && items.length > 8 ? 8 : items.length;
                    return (
                      <div key={type}>
                        <h3 style={{ color: style.color }}>
                          <i style={{ borderColor: style.color }} />
                          {type} <span>{items.length}</span>
                        </h3>
                        {items.slice(0, limit).map(({ edge, out, other }) => (
                          <button
                            key={`${edge.id}_${other.id}`}
                            type="button"
                            className="kg-rel"
                            onClick={() => revealNode(other.id)}
                          >
                            <span className="dir">{out ? '→' : '←'}</span>
                            <span className="kg-dot" style={{ background: nodeStyleOf(other.type).fill }} />
                            <span>{other.name}</span>
                            {edge.redundant && <span className="sub">(cạnh dư)</span>}
                          </button>
                        ))}
                        {limit < items.length && (
                          <div className="kg-empty-sub">… và {items.length - limit} mục khác</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : selectedEdge ? (
              <>
                <h2>Thuộc tính quan hệ</h2>
                <span className="kg-tag" style={{ background: edgeStyleOf(selectedEdge.type).color, color: '#fff' }}>
                  {selectedEdge.type}
                </span>
                <div className="kg-title">
                  {model.byId.get(selectedEdge.sourceId)?.name ?? selectedEdge.sourceId}{' '}
                  <span style={{ color: '#6b7482' }}>→</span>{' '}
                  {model.byId.get(selectedEdge.targetId)?.name ?? selectedEdge.targetId}
                </div>
                {isTeacher && selectedEdge.review && (
                  <div className="kg-warn">
                    Quan hệ này cần giảng viên duyệt (độ tin cậy thấp hoặc do AI đề xuất).
                  </div>
                )}
                {selectedEdge.redundant && (
                  <div className="kg-note">
                    Cạnh dư: giữa hai khái niệm đã có đường tiên quyết gián tiếp.
                  </div>
                )}
                {showEditControls && (
                  <div className="kg-panel-actions">
                    {selectedEdge.review && onApproveEdge && (
                      <button
                        type="button"
                        className="btn btn-primary sm"
                        onClick={() =>
                          void onApproveEdge({
                            fromId: selectedEdge.sourceId,
                            toId: selectedEdge.targetId,
                            edgeType: selectedEdge.type,
                          })
                        }
                      >
                        <CheckCircle2 size={12} /> Duyệt quan hệ
                      </button>
                    )}
                    {onDeleteEdge && (
                      <button
                        type="button"
                        className="btn btn-outline sm"
                        onClick={() => void triggerDeleteSelected()}
                      >
                        <Trash2 size={12} /> Xóa cạnh
                      </button>
                    )}
                  </div>
                )}
                <table className="kg-props">
                  <tbody>
                    <tr>
                      <td>loại</td>
                      <td>{edgeStyleOf(selectedEdge.type).vi}</td>
                    </tr>
                    {typeof selectedEdge.props.confidence === 'number' && (
                      <tr>
                        <td>độ tin cậy</td>
                        <td>
                          {selectedEdge.props.confidence}
                          <div className="kg-bar">
                            <b
                              style={{
                                width: `${Math.round(selectedEdge.props.confidence * 100)}%`,
                                background:
                                  selectedEdge.props.confidence < REVIEW_THRESHOLD ? '#f08a4b' : '#1f9d68',
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                    {Boolean(selectedEdge.props.status) && (
                      <tr>
                        <td>trạng thái</td>
                        <td>{String(selectedEdge.props.status)}</td>
                      </tr>
                    )}
                    {Boolean(selectedEdge.props.reason) && (
                      <tr>
                        <td>lý do</td>
                        <td>{String(selectedEdge.props.reason)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="kg-rels">
                  {[selectedEdge.sourceId, selectedEdge.targetId].map((id, idx) => {
                    const n = model.byId.get(id);
                    if (!n) return null;
                    return (
                      <button key={id} type="button" className="kg-rel" onClick={() => revealNode(id)}>
                        <span className="dir">{idx === 0 ? 'từ' : 'đến'}</span>
                        <span className="kg-dot" style={{ background: nodeStyleOf(n.type).fill }} />
                        <span>{n.name}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h2>Hướng dẫn xem đồ thị</h2>
                <ul className="kg-empty">
                  <li>
                    Mặc định hiển thị theo <b>bậc ngữ nghĩa</b> (Môn học + Chuẩn đầu ra) để dễ quan sát kể cả với đồ thị lớn do AI tạo.
                  </li>
                  <li>
                    Bấm trực tiếp vào <b>nút</b> (hoặc nhãn <b>+N / −</b>) để vừa xem chi tiết vừa mở rộng / thu gọn các khái niệm con.
                  </li>
                  <li>
                    Dùng ô <b>Tìm kiếm</b> để tự động mở đường đến bất kỳ khái niệm nào đang ẩn.
                  </li>
                  <li>
                    Bấm <b>Mở tất cả</b> nếu muốn xem toàn bộ đồ thị cùng lúc, hoặc bật <b>Theo thứ tự học</b> để xếp từ trái sang phải.
                  </li>
                  {isTeacher ? (
                    <li>
                      Chấm cam trên nút thu gọn báo hiệu bên trong có <b>quan hệ cần giảng viên duyệt</b>. Kéo thả nút để ghim vị trí.
                    </li>
                  ) : (
                    <li>
                      Bạn đang xem ở <b>chế độ chỉ xem</b> (đồng bộ trực tiếp với đồ thị do giảng viên quản lý).
                    </li>
                  )}
                </ul>
              </>
            )}
          </aside>
        )}
      </div>

      {tooltip && (
        <div
          className="kg-tip"
          style={{
            left: Math.min(tooltip.x + 14, window.innerWidth - 310),
            top: Math.min(tooltip.y + 14, window.innerHeight - 90),
          }}
        >
          <b>{tooltip.title}</b>
          <div>{tooltip.subtitle}</div>
        </div>
      )}
    </div>
  );
}

import type { KnowledgeEdgeType, KnowledgeGraphData, KnowledgeGraphEdge, KnowledgeGraphNode } from '../../types';

export const REVIEW_THRESHOLD = 0.8;
export const DEFAULT_CHILD_PAGE_SIZE = 12;

export interface NodeStyle {
  fill: string;
  stroke: string;
  r: number;
  vi: string;
}

export interface EdgeStyle {
  color: string;
  w: number;
  dash: string;
  arrow: boolean;
  dist: number;
  str: number;
  vi: string;
}

export const NODE_STYLES: Record<string, NodeStyle> = {
  Course: { fill: '#FFD86E', stroke: '#EDBA39', r: 42, vi: 'Môn học' },
  LO: { fill: '#6DCE9E', stroke: '#4FB383', r: 34, vi: 'Chuẩn đầu ra' },
  Assignment: { fill: '#FF756E', stroke: '#E0504A', r: 32, vi: 'Bài tập' },
  Concept: { fill: '#68BDF6', stroke: '#4A9FD8', r: 30, vi: 'Khái niệm' },
  Item: { fill: '#F79767', stroke: '#D97C4E', r: 26, vi: 'Câu hỏi' },
  Content: { fill: '#C9CDD4', stroke: '#A5ABB6', r: 12, vi: 'Nội dung (slide)' },
  More: { fill: '#eef3f9', stroke: '#0a6ed1', r: 22, vi: 'Xem thêm' },
};

export const EDGE_STYLES: Record<string, EdgeStyle> = {
  PREREQUISITE: { color: '#46556f', w: 2, dash: '', arrow: true, dist: 130, str: 0.25, vi: 'Tiên quyết' },
  PART_OF: { color: '#1f9d68', w: 2.5, dash: '', arrow: true, dist: 100, str: 0.42, vi: 'Là một phần của' },
  RELATED_TO: { color: '#8e98a8', w: 1.6, dash: '5 4', arrow: false, dist: 150, str: 0.14, vi: 'Liên quan' },
  DEVELOP: { color: '#9b6bd1', w: 1.8, dash: '', arrow: true, dist: 150, str: 0.22, vi: 'Góp phần đạt' },
  EXPLAIN: { color: '#b4bac5', w: 1, dash: '', arrow: true, dist: 65, str: 0.48, vi: 'Giải thích' },
  ASSESS: { color: '#f08a4b', w: 1.6, dash: '', arrow: true, dist: 95, str: 0.36, vi: 'Kiểm tra' },
  MORE: { color: '#0a6ed1', w: 1.4, dash: '3 3', arrow: false, dist: 85, str: 0.4, vi: 'Xem thêm' },
};

export function nodeStyleOf(type: string): NodeStyle {
  return NODE_STYLES[type] ?? NODE_STYLES.Concept;
}

export function edgeStyleOf(type: string): EdgeStyle {
  return EDGE_STYLES[type] ?? { color: '#8e98a8', w: 1.4, dash: '', arrow: true, dist: 120, str: 0.2, vi: type };
}

export interface NormalizedNode {
  id: string;
  name: string;
  type: string;
  description: string;
  props: Record<string, unknown>;
  r: number;
  caption: string;
  needsReview: boolean;
  isVirtualMore?: boolean;
  moreParentId?: string;
  moreRemaining?: number;
}

export interface NormalizedEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: KnowledgeEdgeType;
  props: Record<string, unknown>;
  review: boolean;
  redundant: boolean;
}

export interface GraphModel {
  nodes: NormalizedNode[];
  edges: NormalizedEdge[];
  byId: Map<string, NormalizedNode>;
  roots: Set<string>;
  childrenOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  depth: Map<string, number>;
  maxConceptDepth: number;
  reviewDescendantCount: Map<string, number>;
}

function captionOf(n: KnowledgeGraphNode, props: Record<string, unknown>): string {
  if (n.type === 'LO') return String(props.code || n.id);
  if (n.type === 'Course') return String(props.code || n.id);
  if (n.type === 'Assignment') return String(n.name || n.id).split('(')[0].trim();
  if (n.type === 'Content') return '';
  return String(n.name || n.id);
}

function addUnique(map: Map<string, string[]>, key: string, value: string) {
  if (key === value) return;
  let list = map.get(key);
  if (!list) {
    list = [];
    map.set(key, list);
  }
  if (!list.includes(value)) list.push(value);
}

export function buildGraphModel(raw: KnowledgeGraphData): GraphModel {
  const byId = new Map<string, NormalizedNode>();
  const nodes: NormalizedNode[] = [];

  for (const rawNode of raw.nodes) {
    if (!rawNode.id || byId.has(rawNode.id)) continue;
    const props = { ...(rawNode.properties ?? {}) };
    const status = String(props.status ?? '');
    const needsReview = status === 'proposed' || status === 'draft' || status === 'pending_review';
    const node: NormalizedNode = {
      id: rawNode.id,
      name: rawNode.name || rawNode.id,
      type: rawNode.type || 'Concept',
      description: rawNode.description || '',
      props,
      r: nodeStyleOf(rawNode.type || 'Concept').r,
      caption: captionOf(rawNode, props),
      needsReview,
    };
    byId.set(node.id, node);
    nodes.push(node);
  }

  const edges: NormalizedEdge[] = [];
  raw.edges.forEach((e: KnowledgeGraphEdge, index: number) => {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t || s.id === t.id) return;
    const props = { ...(e.properties ?? {}) };
    const confidence = typeof props.confidence === 'number' ? props.confidence : null;
    const review = props.status === 'proposed' || (confidence !== null && confidence < REVIEW_THRESHOLD);
    edges.push({
      id: `e${index}_${s.id}_${t.id}_${e.type}`,
      sourceId: s.id,
      targetId: t.id,
      type: e.type,
      props,
      review,
      redundant: false,
    });
  });

  // PREREQUISITE adjacency for learning order depth & transitive reduction
  const outPrereq = new Map<string, NormalizedEdge[]>();
  const inPrereq = new Map<string, NormalizedEdge[]>();
  const prereqEdges = edges.filter((e) => e.type === 'PREREQUISITE');
  for (const e of prereqEdges) {
    if (!outPrereq.has(e.sourceId)) outPrereq.set(e.sourceId, []);
    outPrereq.get(e.sourceId)!.push(e);
    if (!inPrereq.has(e.targetId)) inPrereq.set(e.targetId, []);
    inPrereq.get(e.targetId)!.push(e);
  }

  const reachablePrereq = (from: string, to: string, skip: NormalizedEdge): boolean => {
    const seen = new Set<string>([from]);
    const stack = [from];
    while (stack.length) {
      const u = stack.pop()!;
      for (const e of outPrereq.get(u) ?? []) {
        if (e === skip) continue;
        if (e.targetId === to) return true;
        if (!seen.has(e.targetId)) {
          seen.add(e.targetId);
          stack.push(e.targetId);
        }
      }
    }
    return false;
  };
  for (const e of prereqEdges) {
    e.redundant = reachablePrereq(e.sourceId, e.targetId, e);
  }

  const depth = new Map<string, number>();
  const computeDepth = (id: string, stack: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    let d = 0;
    for (const e of inPrereq.get(id) ?? []) {
      d = Math.max(d, computeDepth(e.sourceId, stack) + 1);
    }
    stack.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const n of nodes) {
    if (n.type === 'Concept' || n.type === 'Assignment') computeDepth(n.id, new Set());
  }
  let maxConceptDepth = 0;
  for (const n of nodes) {
    if (n.type === 'Concept') maxConceptDepth = Math.max(maxConceptDepth, depth.get(n.id) ?? 0);
  }
  for (const e of edges) {
    const s = byId.get(e.sourceId)!;
    const t = byId.get(e.targetId)!;
    if (e.type === 'DEVELOP' && s.type === 'Concept' && t.type === 'LO') {
      depth.set(t.id, Math.max(depth.get(t.id) ?? 0, (depth.get(s.id) ?? 0) + 1));
    }
  }
  for (const e of edges) {
    const s = byId.get(e.sourceId)!;
    const t = byId.get(e.targetId)!;
    if (e.type === 'DEVELOP' && s.type === 'LO' && t.type === 'Course') {
      depth.set(t.id, Math.max(depth.get(t.id) ?? 0, (depth.get(s.id) ?? 0) + 1));
    }
  }
  for (const n of nodes) {
    if (n.type === 'LO' && !depth.has(n.id)) depth.set(n.id, maxConceptDepth + 1);
    if (n.type === 'Course' && !depth.has(n.id)) depth.set(n.id, maxConceptDepth + 2);
  }

  // Track PART_OF parents for concepts so LO expands primary concepts first instead of dumping every leaf
  const partOfParent = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.type === 'PART_OF') {
      if (!partOfParent.has(e.sourceId)) partOfParent.set(e.sourceId, new Set());
      partOfParent.get(e.sourceId)!.add(e.targetId);
    }
  }

  const developsLo = new Map<string, Set<string>>();
  for (const e of edges) {
    const s = byId.get(e.sourceId)!;
    const t = byId.get(e.targetId)!;
    if (e.type === 'DEVELOP' && t.type === 'LO') {
      if (!developsLo.has(t.id)) developsLo.set(t.id, new Set());
      developsLo.get(t.id)!.add(s.id);
    }
  }

  // Semantic parent -> children graph (handles arbitrary LLM-generated graphs cleanly)
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const linkChild = (parentId: string, childId: string) => {
    if (parentId === childId || !byId.has(parentId) || !byId.has(childId)) return;
    addUnique(childrenOf, parentId, childId);
    addUnique(parentsOf, childId, parentId);
  };

  for (const e of edges) {
    const s = byId.get(e.sourceId)!;
    const t = byId.get(e.targetId)!;

    // Tier 1 -> Tier 2: Course -> LO
    if (e.type === 'DEVELOP' && s.type === 'LO' && t.type === 'Course') {
      linkChild(t.id, s.id);
      continue;
    }

    // Tier 1/2: LO -> primary Concepts (skip sub-concepts whose PART_OF parent also develops the same LO) & Assignments
    if (e.type === 'DEVELOP' && t.type === 'LO') {
      if (s.type === 'Concept') {
        const loSet = developsLo.get(t.id);
        const parents = partOfParent.get(s.id);
        const hasParentInSameLo =
          parents && loSet ? Array.from(parents).some((pid) => loSet.has(pid)) : false;
        if (!hasParentInSameLo) {
          linkChild(t.id, s.id);
        }
      } else {
        linkChild(t.id, s.id);
      }
      continue;
    }

    // Tier 2 -> Tier 3: Concept -> sub-Concept via PART_OF (child -[PART_OF]-> parent)
    if (e.type === 'PART_OF') {
      linkChild(t.id, s.id);
      continue;
    }

    // Concept -> Concept via PREREQUISITE / RELATED_TO
    if (e.type === 'PREREQUISITE' && !e.redundant) {
      linkChild(s.id, t.id);
      continue;
    }
    if (e.type === 'RELATED_TO') {
      linkChild(s.id, t.id);
      continue;
    }

    // Concept <-> Assignment / Item via ASSESS
    if (e.type === 'ASSESS') {
      if (s.type === 'Assignment' || s.type === 'Item') {
        linkChild(t.id, s.id);
      } else {
        linkChild(s.id, t.id);
      }
      continue;
    }

    // Tier 3 -> Tier 4: Concept / Assignment / Item -> Content (slide) via EXPLAIN (Content -[EXPLAIN]-> Concept)
    if (e.type === 'EXPLAIN') {
      if (s.type === 'Content') {
        linkChild(t.id, s.id);
      } else {
        linkChild(s.id, t.id);
      }
      continue;
    }
  }

  // Determine Tier 1 Roots with safe fallbacks for arbitrary LLM graphs
  const roots = new Set<string>();
  const courseNodes = nodes.filter((n) => n.type === 'Course');
  const loNodes = nodes.filter((n) => n.type === 'LO');

  if (loNodes.length > 0) {
    courseNodes.forEach((c) => roots.add(c.id));
    loNodes.forEach((lo) => {
      roots.add(lo.id);
      if (courseNodes[0]) linkChild(courseNodes[0].id, lo.id);
    });
  } else if (courseNodes.length > 0) {
    courseNodes.forEach((c) => roots.add(c.id));
    const topConcepts = nodes.filter((n) => n.type === 'Concept' && !partOfParent.has(n.id));
    topConcepts.slice(0, 12).forEach((c) => {
      roots.add(c.id);
      linkChild(courseNodes[0].id, c.id);
    });
  } else {
    // Fallback when AI graph has neither Course nor LO
    const topConcepts = nodes.filter((n) => n.type !== 'Content' && !partOfParent.has(n.id));
    if (topConcepts.length > 0 && topConcepts.length <= 20) {
      topConcepts.forEach((n) => roots.add(n.id));
    } else {
      const deg = new Map<string, number>();
      edges.forEach((e) => {
        deg.set(e.sourceId, (deg.get(e.sourceId) ?? 0) + 1);
        deg.set(e.targetId, (deg.get(e.targetId) ?? 0) + 1);
      });
      [...nodes]
        .filter((n) => n.type !== 'Content')
        .sort((a, b) => (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0))
        .slice(0, Math.min(10, nodes.length))
        .forEach((n) => roots.add(n.id));
    }
  }

  // Ensure every non-Content node is reachable from roots (safeguard against AI orphan nodes)
  const reachableFromRoots = new Set<string>();
  const bfsQueue = [...roots];
  bfsQueue.forEach((id) => reachableFromRoots.add(id));
  while (bfsQueue.length) {
    const u = bfsQueue.shift()!;
    for (const v of childrenOf.get(u) ?? []) {
      if (!reachableFromRoots.has(v)) {
        reachableFromRoots.add(v);
        bfsQueue.push(v);
      }
    }
  }

  const primaryRoot = courseNodes[0]?.id ?? [...roots][0] ?? null;
  for (const n of nodes) {
    if (n.type === 'Content' || reachableFromRoots.has(n.id)) continue;
    // Prefer attaching top-level orphans directly to primaryRoot so their PART_OF children also become reachable
    if (!partOfParent.has(n.id) && primaryRoot) {
      linkChild(primaryRoot, n.id);
      const q = [n.id];
      reachableFromRoots.add(n.id);
      while (q.length) {
        const u = q.shift()!;
        for (const v of childrenOf.get(u) ?? []) {
          if (!reachableFromRoots.has(v)) {
            reachableFromRoots.add(v);
            q.push(v);
          }
        }
      }
    }
  }
  for (const n of nodes) {
    if (n.type === 'Content' || reachableFromRoots.has(n.id)) continue;
    if (primaryRoot) {
      linkChild(primaryRoot, n.id);
    } else {
      roots.add(n.id);
    }
    reachableFromRoots.add(n.id);
  }

  // Sort each parent's children predictably (by type priority, chapter_id, learning depth, then name)
  const typePriority: Record<string, number> = {
    LO: 0,
    Concept: 1,
    Assignment: 2,
    Item: 3,
    Content: 4,
  };
  for (const [, list] of childrenOf) {
    list.sort((aId, bId) => {
      const a = byId.get(aId)!;
      const b = byId.get(bId)!;
      const tp = (typePriority[a.type] ?? 5) - (typePriority[b.type] ?? 5);
      if (tp !== 0) return tp;
      const ca = String(a.props.chapter_id ?? '');
      const cb = String(b.props.chapter_id ?? '');
      if (ca !== cb) return ca.localeCompare(cb);
      const da = depth.get(aId) ?? 0;
      const db = depth.get(bId) ?? 0;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name);
    });
  }

  // Precompute review descendant counts (cycle-safe BFS per node) for teacher orange indicator dot
  const edgeReviewByNode = new Map<string, number>();
  for (const e of edges) {
    if (!e.review) continue;
    edgeReviewByNode.set(e.sourceId, (edgeReviewByNode.get(e.sourceId) ?? 0) + 1);
    edgeReviewByNode.set(e.targetId, (edgeReviewByNode.get(e.targetId) ?? 0) + 1);
  }

  const reviewDescendantCount = new Map<string, number>();
  for (const n of nodes) {
    const directChildren = childrenOf.get(n.id);
    if (!directChildren?.length) {
      reviewDescendantCount.set(n.id, 0);
      continue;
    }
    const visited = new Set<string>([n.id]);
    const queue = [...directChildren];
    let count = 0;
    while (queue.length) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const curNode = byId.get(cur);
      if (curNode && (curNode.needsReview || (edgeReviewByNode.get(cur) ?? 0) > 0)) {
        count += 1;
      }
      for (const next of childrenOf.get(cur) ?? []) {
        if (!visited.has(next)) queue.push(next);
      }
    }
    reviewDescendantCount.set(n.id, count);
  }

  return {
    nodes,
    edges,
    byId,
    roots,
    childrenOf,
    parentsOf,
    depth,
    maxConceptDepth,
    reviewDescendantCount,
  };
}

/** Reverse-BFS from targetId to nearest root so search/review can auto-expand hidden paths. */
export function findAncestorPath(model: GraphModel, targetId: string): string[] {
  if (model.roots.has(targetId)) return [];
  const visited = new Set<string>([targetId]);
  const parentTrace = new Map<string, string>();
  const queue: string[] = [targetId];

  while (queue.length) {
    const cur = queue.shift()!;
    for (const p of model.parentsOf.get(cur) ?? []) {
      if (visited.has(p)) continue;
      visited.add(p);
      parentTrace.set(p, cur);
      if (model.roots.has(p)) {
        // Reconstruct path from root down to parent of targetId
        const toExpand: string[] = [];
        let walker: string | undefined = p;
        while (walker && walker !== targetId) {
          toExpand.push(walker);
          walker = parentTrace.get(walker);
        }
        return toExpand;
      }
      queue.push(p);
    }
  }
  return [];
}

export interface VisibilityOptions {
  showAll: boolean;
  expanded: Set<string>;
  pageLimits: Map<string, number>;
  hiddenNodeTypes: Set<string>;
  hiddenEdgeTypes: Set<string>;
  hideRedundant: boolean;
}

export interface VisibleGraphResult {
  nodes: NormalizedNode[];
  edges: NormalizedEdge[];
  hiddenChildCount: Map<string, number>;
  expandableCount: Map<string, number>;
  spawnAnchor: Map<string, string>;
}

export function computeVisibleGraph(model: GraphModel, opts: VisibilityOptions): VisibleGraphResult {
  const { showAll, expanded, pageLimits, hiddenNodeTypes, hiddenEdgeTypes, hideRedundant } = opts;

  const visibleIds = new Set<string>();
  const spawnAnchor = new Map<string, string>();
  const virtualMoreNodes: NormalizedNode[] = [];
  const virtualMoreEdges: NormalizedEdge[] = [];

  if (showAll) {
    for (const n of model.nodes) {
      if (!hiddenNodeTypes.has(n.type)) visibleIds.add(n.id);
    }
  } else {
    for (const rootId of model.roots) {
      const node = model.byId.get(rootId);
      if (node && !hiddenNodeTypes.has(node.type)) visibleIds.add(rootId);
    }

    // Fixed-point propagation so chained expanded ancestors reveal their children cleanly
    let changed = true;
    while (changed) {
      changed = false;
      for (const parentId of expanded) {
        if (!visibleIds.has(parentId)) continue;
        const allChildren = (model.childrenOf.get(parentId) ?? []).filter((cid) => {
          const child = model.byId.get(cid);
          return child && !hiddenNodeTypes.has(child.type);
        });
        const limit = pageLimits.get(parentId) ?? DEFAULT_CHILD_PAGE_SIZE;
        const slice = allChildren.slice(0, limit);
        for (const cid of slice) {
          if (!visibleIds.has(cid)) {
            visibleIds.add(cid);
            spawnAnchor.set(cid, parentId);
            changed = true;
          }
        }
      }
    }

    // Add "+N xem thêm" pagination nodes for expanded parents that still have hidden children beyond limit
    for (const parentId of expanded) {
      if (!visibleIds.has(parentId)) continue;
      const eligible = (model.childrenOf.get(parentId) ?? []).filter((cid) => {
        const child = model.byId.get(cid);
        return child && !hiddenNodeTypes.has(child.type);
      });
      const limit = pageLimits.get(parentId) ?? DEFAULT_CHILD_PAGE_SIZE;
      const remaining = eligible.length - limit;
      if (remaining > 0) {
        const moreId = `__more__${parentId}`;
        virtualMoreNodes.push({
          id: moreId,
          name: `Xem thêm ${remaining} mục`,
          type: 'More',
          description: `Bấm để hiện thêm tối đa ${DEFAULT_CHILD_PAGE_SIZE} nút con.`,
          props: {},
          r: NODE_STYLES.More.r,
          caption: `+${remaining} nữa`,
          needsReview: false,
          isVirtualMore: true,
          moreParentId: parentId,
          moreRemaining: remaining,
        });
        spawnAnchor.set(moreId, parentId);
        virtualMoreEdges.push({
          id: `e_more_${parentId}`,
          sourceId: parentId,
          targetId: moreId,
          type: 'MORE',
          props: {},
          review: false,
          redundant: false,
        });
      }
    }
  }

  const visibleNodes: NormalizedNode[] = [];
  for (const n of model.nodes) {
    if (visibleIds.has(n.id)) visibleNodes.push(n);
  }
  visibleNodes.push(...virtualMoreNodes);

  const visibleEdges = model.edges.filter(
    (e) =>
      visibleIds.has(e.sourceId) &&
      visibleIds.has(e.targetId) &&
      !hiddenEdgeTypes.has(e.type) &&
      !(hideRedundant && e.redundant),
  );
  visibleEdges.push(...virtualMoreEdges);

  // Badge counts: hiddenChildCount = how many eligible children are currently NOT visible
  const hiddenChildCount = new Map<string, number>();
  const expandableCount = new Map<string, number>();
  for (const n of visibleNodes) {
    if (n.isVirtualMore) continue;
    const eligible = (model.childrenOf.get(n.id) ?? []).filter((cid) => {
      const child = model.byId.get(cid);
      return child && !hiddenNodeTypes.has(child.type);
    });
    expandableCount.set(n.id, eligible.length);
    const hidden = eligible.filter((cid) => !visibleIds.has(cid)).length;
    hiddenChildCount.set(n.id, hidden);
  }

  return { nodes: visibleNodes, edges: visibleEdges, hiddenChildCount, expandableCount, spawnAnchor };
}

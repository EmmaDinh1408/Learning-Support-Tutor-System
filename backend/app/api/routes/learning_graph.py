from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import get_current_user, require_roles
from app.api.routes.courses import _course_access
from app.domain.models.api import (
    ApproveGraphEdgeRequest,
    CreateGraphEdgeRequest,
    CreateGraphNodeRequest,
    DeleteGraphEdgeRequest,
    MergeGraphNodesRequest,
    UpdateGraphNodeRequest,
)
from app.infrastructure.neo4j.driver import run_read, run_write

router = APIRouter(tags=["Learning graph"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]
StudentUser = Annotated[dict[str, Any], Depends(require_roles("student"))]
TeacherUser = Annotated[dict[str, Any], Depends(require_roles("teacher"))]



def _student_node(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record["id"],
        "label": record["label"],
        "sub": record.get("sub"),
        "x": record.get("x", 0),
        "y": record.get("y", 0),
        "status": record["status"],
        "mastery": record.get("mastery"),
        "lo": record.get("lo"),
        "tag": record.get("tag"),
        "drillable": bool(record.get("drillable", False)),
    }


def _teacher_node(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record["id"],
        "name": record["name"],
        "status": record.get("status", "approved"),
        "x": record.get("x", 0),
        "y": record.get("y", 0),
        "lo": record.get("lo", []),
        "incoming": record.get("incoming", 0),
        "outgoing": record.get("outgoing", 0),
        "contents": record.get("contents", 0),
        "questions": record.get("questions", 0),
    }


@router.get("/student/courses/{course_id}/learning-outcomes")
def get_learning_outcomes(course_id: str, user: StudentUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    return run_read(
        """
        MATCH (outcome:LearningOutcome)-[:IN_COURSE]->(:Course {id: $course_id})
        OPTIONAL MATCH (node:LearningNode)-[:ALIGNS_WITH]->(outcome)
        OPTIONAL MATCH (:User {id: $user_id})-[progress:HAS_PROGRESS]->(node)
        WITH outcome, count(DISTINCT node) AS total,
             count(DISTINCT CASE WHEN progress.mastery >= 80 THEN node END) AS done
        RETURN outcome.id AS id, coalesce(outcome.title, outcome.description, '') AS title,
               done AS done, total AS total,
               CASE WHEN total = 0 THEN 0 ELSE round(done * 100.0 / total) END AS percent
        ORDER BY outcome.sequence
        """,
        {"course_id": course_id, "user_id": user["id"]},
    )


@router.get("/student/courses/{course_id}/graph")
def get_student_graph(course_id: str, user: StudentUser, cluster_id: str | None = None) -> dict[str, Any]:
    _course_access(course_id, user)
    nodes = run_read(
        """
        MATCH (node:LearningNode)-[:IN_COURSE]->(:Course {id: $course_id})
        OPTIONAL MATCH (node)-[:IN_CLUSTER]->(cluster:LearningCluster)
        OPTIONAL MATCH (:User {id: $user_id})-[progress:HAS_PROGRESS]->(node)
        OPTIONAL MATCH (node)-[:REQUIRES]->(prerequisite:LearningNode)
        WITH node, cluster, progress, collect(DISTINCT prerequisite) AS prerequisites
        WHERE $cluster_id IS NULL OR cluster.id = $cluster_id
        RETURN node.id AS id, node.title AS label, node.subtitle AS sub,
               coalesce(node.x, 0) AS x, coalesce(node.y, 0) AS y,
               CASE
                 WHEN progress.mastery >= 80 THEN 'mastered'
                 WHEN progress.mastery > 0 THEN 'progress'
                 WHEN any(item IN prerequisites WHERE NOT EXISTS {
                   MATCH (:User {id: $user_id})-[state:HAS_PROGRESS]->(item)
                   WHERE state.mastery >= 80
                 }) THEN 'locked'
                 ELSE coalesce(node.defaultStatus, 'available')
               END AS status,
               progress.mastery AS mastery, node.learningOutcomeId AS lo,
               node.tag AS tag, coalesce(node.drillable, false) AS drillable
        ORDER BY node.sequence
        """,
        {"course_id": course_id, "user_id": user["id"], "cluster_id": cluster_id},
    )
    edges = run_read(
        """
        MATCH (source:LearningNode)-[relationship:REQUIRES|RELATED|CONCEPT]->(target:LearningNode)
        MATCH (source)-[:IN_COURSE]->(:Course {id: $course_id})
        MATCH (target)-[:IN_COURSE]->(:Course {id: $course_id})
        OPTIONAL MATCH (source)-[:IN_CLUSTER]->(cluster:LearningCluster)
        WHERE $cluster_id IS NULL OR cluster.id = $cluster_id
        RETURN source.id AS from, target.id AS to,
               CASE type(relationship)
                 WHEN 'REQUIRES' THEN 'prereq'
                 WHEN 'RELATED' THEN 'related'
                 ELSE 'concept'
               END AS kind
        """,
        {"course_id": course_id, "cluster_id": cluster_id},
    )
    node_ids = {node["id"] for node in nodes}
    filtered_edges = [edge for edge in edges if edge["from"] in node_ids and edge["to"] in node_ids]
    return {"nodes": [_student_node(node) for node in nodes], "edges": filtered_edges}


@router.get("/student/nodes/{node_id}")
def get_student_node(node_id: str, user: StudentUser) -> dict[str, Any]:
    records = run_read(
        """
        MATCH (node:LearningNode {id: $node_id})-[:IN_COURSE]->(course:Course)
        OPTIONAL MATCH (:User {id: $user_id})-[progress:HAS_PROGRESS]->(node)
        OPTIONAL MATCH (node)-[:REQUIRES]->(prerequisite:LearningNode)
        OPTIONAL MATCH (:User {id: $user_id})-[prereq_progress:HAS_PROGRESS]->(prerequisite)
        WITH node, course, progress, collect(DISTINCT {
          title: prerequisite.title,
          state: coalesce(prerequisite.defaultStatus, 'available'),
          done: prereq_progress.mastery >= 80
        }) AS prerequisites
        RETURN properties(node) AS node, course.id AS courseId, course.title AS courseTitle,
               course.code AS courseCode, progress.mastery AS mastery,
               prerequisites AS prerequisites
        LIMIT 1
        """,
        {"node_id": node_id, "user_id": user["id"]},
    )
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy nội dung kiến thức.")
    record = records[0]
    _course_access(record["courseId"], user)
    node = record["node"]
    mastery = float(record.get("mastery") or 0)
    return {
        "id": node_id,
        "title": node.get("title", ""),
        "course": record["courseTitle"],
        "cluster": node.get("clusterName", ""),
        "statusLabel": node.get("statusLabel", "Chưa học"),
        "status": "mastered" if mastery >= 80 else ("progress" if mastery > 0 else "available"),
        "mastery": mastery,
        "lo": node.get("learningOutcomeId", ""),
        "prerequisites": [item for item in record["prerequisites"] if item.get("title")],
        "aiHint": node.get("aiHint"),
        "cta": node.get("cta", "Mở nội dung"),
    }


def _course_graph_overview(course_id: str) -> dict[str, Any]:
    clusters = run_read(
        """
        MATCH (cluster:LearningCluster)-[:IN_COURSE]->(:Course {id: $course_id})
        OPTIONAL MATCH (node:LearningNode)-[:IN_CLUSTER]->(cluster)
        OPTIONAL MATCH (node)-[:ALIGNS_WITH]->(outcome:LearningOutcome)
        WITH cluster, collect(DISTINCT node) AS nodes, collect(DISTINCT outcome.id) AS outcomes
        RETURN cluster.id AS id, coalesce(cluster.sequence, 0) AS index,
               cluster.name AS name, size(nodes) AS nodeCount,
               coalesce(cluster.x, 0) AS x, coalesce(cluster.y, 0) AS y,
               coalesce(cluster.lo, [outcome IN outcomes WHERE outcome IS NOT NULL]) AS lo,
               cluster.approved AS approved,
               coalesce(cluster.struggle, 0) AS struggle
        ORDER BY cluster.sequence
        """,
        {"course_id": course_id},
    )
    edges = run_read(
        """
        MATCH (source:LearningCluster)-[rel:REQUIRES|RELATED|RELATED_TO|CONCEPT]->(target:LearningCluster)
        MATCH (source)-[:IN_COURSE]->(:Course {id: $course_id})
        RETURN source.id AS from, target.id AS to,
               CASE type(rel)
                 WHEN 'REQUIRES' THEN 'prereq'
                 WHEN 'CONCEPT' THEN 'concept'
                 ELSE 'related'
               END AS kind
        """,
        {"course_id": course_id},
    )
    stats = run_read(
        """
        MATCH (course:Course {id: $course_id})
        OPTIONAL MATCH (node:LearningNode)-[:IN_COURSE]->(course)
        WITH course, count(node) AS nodeCount,
             count(CASE WHEN node.status = 'draft' OR node.status = 'pending_review' THEN 1 END) AS drafts
        OPTIONAL MATCH (source:LearningNode)-[edge:REQUIRES|RELATED|RELATED_TO|CONCEPT]->(target:LearningNode)
        WHERE (source)-[:IN_COURSE]->(course) AND (target)-[:IN_COURSE]->(course)
        RETURN nodeCount AS nodes, count(edge) AS edges, drafts AS drafts
        """,
        {"course_id": course_id},
    )
    return {
        "clusters": [
            {
                **cluster,
                "approved": bool(cluster.get("approved", False)),
                "issue": None,
            }
            for cluster in clusters
        ],
        "clusterEdges": edges,
        "stats": stats[0] if stats else {"nodes": 0, "edges": 0, "drafts": 0},
    }


def _cluster_view_data(cluster_id: str) -> dict[str, Any]:
    nodes = run_read(
        """
        MATCH (node:LearningNode)-[:IN_CLUSTER]->(:LearningCluster {id: $cluster_id})
        OPTIONAL MATCH (node)-[:ALIGNS_WITH]->(outcome:LearningOutcome)
        OPTIONAL MATCH (node)-[:HAS_RESOURCE]->(resource:LearningResource)
        OPTIONAL MATCH (node)-[:HAS_QUIZ]->(quiz:Quiz)
        OPTIONAL MATCH (incoming:LearningNode)-[:REQUIRES|RELATED|RELATED_TO|CONCEPT]->(node)
        OPTIONAL MATCH (node)-[:REQUIRES|RELATED|RELATED_TO|CONCEPT]->(outgoing:LearningNode)
        RETURN node.id AS id, node.title AS name, coalesce(node.status, 'approved') AS status,
               coalesce(node.x, 0) AS x, coalesce(node.y, 0) AS y,
               coalesce(node.lo, collect(DISTINCT outcome.id)) AS lo,
               count(DISTINCT incoming) AS incoming,
               count(DISTINCT outgoing) AS outgoing,
               count(DISTINCT resource) AS contents, count(DISTINCT quiz) AS questions
        ORDER BY node.sequence
        """,
        {"cluster_id": cluster_id},
    )
    edges = run_read(
        """
        MATCH (source:LearningNode)-[relationship:REQUIRES|RELATED|RELATED_TO|CONCEPT]->(target:LearningNode)
        WHERE (source)-[:IN_CLUSTER]->(:LearningCluster {id: $cluster_id})
          AND (target)-[:IN_CLUSTER]->(:LearningCluster {id: $cluster_id})
        RETURN source.id AS from, target.id AS to,
               CASE type(relationship)
                 WHEN 'REQUIRES' THEN 'prereq'
                 WHEN 'CONCEPT' THEN 'concept'
                 ELSE 'related'
               END AS kind
        """,
        {"cluster_id": cluster_id},
    )
    return {"nodes": [_teacher_node(node) for node in nodes], "edges": edges}


def _normalize_edge_type(rel_type: str) -> str:
    mapping = {
        "REQUIRES": "PREREQUISITE",
        "PREREQUISITE": "PREREQUISITE",
        "PART_OF": "PART_OF",
        "IN_CLUSTER": "PART_OF",
        "RELATED": "RELATED_TO",
        "RELATED_TO": "RELATED_TO",
        "CONCEPT": "RELATED_TO",
        "ALIGNS_WITH": "DEVELOP",
        "DEVELOP": "DEVELOP",
        "HAS_RESOURCE": "EXPLAIN",
        "EXPLAIN": "EXPLAIN",
        "HAS_QUIZ": "ASSESS",
        "ASSESS": "ASSESS",
    }
    return mapping.get(rel_type, rel_type)


def _node_type_from_labels(labels: list[str], props: dict[str, Any]) -> str:
    explicit = props.get("nodeType")
    if isinstance(explicit, str) and explicit in {"Course", "LO", "Concept", "Assignment", "Item", "Content"}:
        return explicit
    label_set = set(labels)
    if "Course" in label_set:
        return "Course"
    if "LO" in label_set or "LearningOutcome" in label_set:
        return "LO"
    if "Assignment" in label_set:
        return "Assignment"
    if "Item" in label_set or "QuizQuestion" in label_set or "Quiz" in label_set:
        return "Item"
    if "Content" in label_set or "LearningResource" in label_set:
        return "Content"
    return "Concept"


@router.get("/courses/{course_id}/knowledge-graph")
def get_course_knowledge_graph(course_id: str, user: CurrentUser) -> dict[str, Any]:
    """Universal knowledge graph payload ({nodes, edges}) shared by students (read-only) and teachers (editable)."""
    _course_access(course_id, user)
    course_rows = run_read(
        """
        MATCH (course:Course {id: $course_id})
        RETURN course.id AS id, coalesce(course.title, course.code, course.id) AS name,
               coalesce(course.description, '') AS description, properties(course) AS props
        LIMIT 1
        """,
        {"course_id": course_id},
    )
    if not course_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa học.")

    nodes_by_id: dict[str, dict[str, Any]] = {}
    course_row = course_rows[0]
    nodes_by_id[course_row["id"]] = {
        "id": course_row["id"],
        "name": course_row["name"],
        "type": "Course",
        "description": course_row["description"],
        "properties": {"code": course_row["props"].get("code", course_row["id"])},
    }

    entity_rows = run_read(
        """
        MATCH (course:Course {id: $course_id})
        MATCH (n)-[:IN_COURSE|FOR_COURSE|DEVELOP*1..2]->(course)
        WHERE any(lbl IN labels(n) WHERE lbl IN [
          'LearningOutcome', 'LO', 'LearningCluster', 'LearningNode',
          'Concept', 'Assignment', 'Quiz', 'QuizQuestion', 'Item',
          'LearningResource', 'Content'
        ])
        RETURN DISTINCT n.id AS id, labels(n) AS labels, properties(n) AS props
        """,
        {"course_id": course_id},
    )
    for row in entity_rows:
        node_id = row.get("id")
        if not node_id or node_id in nodes_by_id:
            continue
        props = dict(row.get("props") or {})
        node_type = _node_type_from_labels(row.get("labels") or [], props)
        name = str(props.get("name") or props.get("title") or props.get("nameVi") or props.get("prompt") or node_id)
        description = str(props.get("description") or "")
        clean_props = {
            k: v
            for k, v in props.items()
            if k not in {"id", "name", "title", "description"} and isinstance(v, (str, int, float, bool, list))
        }
        if node_type == "LO" and "code" not in clean_props:
            clean_props["code"] = props.get("code") or node_id
        nodes_by_id[node_id] = {
            "id": node_id,
            "name": name,
            "type": node_type,
            "description": description,
            "properties": clean_props,
        }

    # Include resources/items attached to course nodes even if not directly linked to Course
    attached_rows = run_read(
        """
        MATCH (n)-[:IN_COURSE]->(:Course {id: $course_id})
        OPTIONAL MATCH (n)-[r:HAS_RESOURCE|HAS_QUIZ|EXPLAIN|ASSESS]-(m)
        WHERE m IS NOT NULL AND m.id IS NOT NULL
        RETURN DISTINCT m.id AS id, labels(m) AS labels, properties(m) AS props
        """,
        {"course_id": course_id},
    )
    for row in attached_rows:
        node_id = row.get("id")
        if not node_id or node_id in nodes_by_id:
            continue
        props = dict(row.get("props") or {})
        node_type = _node_type_from_labels(row.get("labels") or [], props)
        name = str(props.get("name") or props.get("title") or props.get("nameVi") or props.get("prompt") or node_id)
        clean_props = {
            k: v
            for k, v in props.items()
            if k not in {"id", "name", "title", "description"} and isinstance(v, (str, int, float, bool, list))
        }
        nodes_by_id[node_id] = {
            "id": node_id,
            "name": name,
            "type": node_type,
            "description": str(props.get("description") or ""),
            "properties": clean_props,
        }

    node_ids = list(nodes_by_id.keys())
    edge_rows = run_read(
        """
        MATCH (s)-[r]->(t)
        WHERE s.id IN $ids AND t.id IN $ids
          AND type(r) IN [
            'REQUIRES', 'PREREQUISITE', 'PART_OF', 'IN_CLUSTER',
            'RELATED', 'RELATED_TO', 'CONCEPT', 'ALIGNS_WITH',
            'DEVELOP', 'HAS_RESOURCE', 'EXPLAIN', 'HAS_QUIZ', 'ASSESS'
          ]
        RETURN s.id AS source, t.id AS target, type(r) AS relType, properties(r) AS props
        """,
        {"ids": node_ids},
    )

    edges_out: list[dict[str, Any]] = []
    seen_edges: set[tuple[str, str, str]] = set()
    for row in edge_rows:
        rel_type = row["relType"]
        src = row["source"]
        tgt = row["target"]
        norm = _normalize_edge_type(rel_type)
        # Flip HAS_RESOURCE / HAS_QUIZ so Content -[EXPLAIN]-> Concept & Item -[ASSESS]-> Concept match ontology
        if rel_type in {"HAS_RESOURCE", "HAS_QUIZ"}:
            src, tgt = tgt, src
        key = (src, tgt, norm)
        if key in seen_edges or src == tgt:
            continue
        seen_edges.add(key)
        raw_props = dict(row.get("props") or {})
        clean_props = {
            k: v for k, v in raw_props.items() if isinstance(v, (str, int, float, bool, list))
        }
        edges_out.append({"source": src, "target": tgt, "type": norm, "properties": clean_props})

    # Ensure every LO links to Course via DEVELOP so hierarchy roots always connect cleanly
    for node_id, node in nodes_by_id.items():
        if node["type"] == "LO":
            key = (node_id, course_id, "DEVELOP")
            if key not in seen_edges:
                seen_edges.add(key)
                edges_out.append({"source": node_id, "target": course_id, "type": "DEVELOP", "properties": {}})

    return {"nodes": list(nodes_by_id.values()), "edges": edges_out}


@router.get("/courses/{course_id}/graph")
def get_course_graph(course_id: str, user: CurrentUser) -> dict[str, Any]:
    """Unified graph structure for both enrolled students (read-only) and teachers (editable)."""
    _course_access(course_id, user)
    return _course_graph_overview(course_id)


@router.get("/courses/{course_id}/clusters/{cluster_id}")
def get_course_cluster_view(course_id: str, cluster_id: str, user: CurrentUser) -> dict[str, Any]:
    """Unified cluster detail view for both enrolled students (read-only) and teachers (editable)."""
    _course_access(course_id, user)
    records = run_read(
        """
        MATCH (cluster:LearningCluster {id: $cluster_id})-[:IN_COURSE]->(:Course {id: $course_id})
        RETURN cluster.id AS id LIMIT 1
        """,
        {"cluster_id": cluster_id, "course_id": course_id},
    )
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cụm kiến thức.")
    return _cluster_view_data(cluster_id)


@router.get("/teacher/courses/{course_id}/graph")
def get_teacher_graph(course_id: str, user: TeacherUser) -> dict[str, Any]:
    _course_access(course_id, user)
    return _course_graph_overview(course_id)


@router.get("/teacher/clusters/{cluster_id}")
def get_cluster_view(cluster_id: str, user: TeacherUser) -> dict[str, Any]:
    records = run_read(
        """
        MATCH (cluster:LearningCluster {id: $cluster_id})-[:IN_COURSE]->(course:Course)
        RETURN course.id AS courseId
        LIMIT 1
        """,
        {"cluster_id": cluster_id},
    )
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cụm kiến thức.")
    _course_access(records[0]["courseId"], user)
    return _cluster_view_data(cluster_id)



@router.get("/teacher/courses/{course_id}/review-queue")
def get_review_queue(course_id: str, user: TeacherUser) -> dict[str, Any]:
    _course_access(course_id, user)
    items = run_read(
        """
        MATCH (node:LearningNode)-[:IN_COURSE]->(:Course {id: $course_id})
        WHERE node.status IN ['draft', 'pending_review']
           OR NOT EXISTS { MATCH (node)-[:ALIGNS_WITH]->(:LearningOutcome) }
           OR NOT EXISTS { MATCH (node)-[:HAS_QUIZ]->(:Quiz) }
        OPTIONAL MATCH (node)-[:IN_CLUSTER]->(cluster:LearningCluster)
        RETURN node.id AS id, node.title AS title, coalesce(cluster.name, 'Chưa phân cụm') AS cluster,
               CASE WHEN node.status IN ['draft', 'pending_review'] THEN 'Chờ duyệt'
                    WHEN NOT EXISTS { MATCH (node)-[:HAS_QUIZ]->(:Quiz) } THEN 'Thiếu câu hỏi'
                    ELSE 'Thiếu chuẩn đầu ra' END AS tag,
               CASE WHEN node.status IN ['draft', 'pending_review'] THEN 'warn'
                    WHEN NOT EXISTS { MATCH (node)-[:ALIGNS_WITH]->(:LearningOutcome) } THEN 'error'
                    ELSE 'info' END AS severity
        ORDER BY node.title
        """,
        {"course_id": course_id},
    )
    return {
        "total": len(items),
        "pending": sum(item["tag"] == "Chờ duyệt" for item in items),
        "missingTest": sum(item["tag"] == "Thiếu câu hỏi" for item in items),
        "cycleWarn": 0,
        "noLo": sum(item["tag"] == "Thiếu chuẩn đầu ra" for item in items),
        "items": items,
    }


@router.get("/teacher/analytics/heatmap")
def get_heat_spot(user: TeacherUser, cluster_id: str | None = None) -> dict[str, Any]:
    course_filter = run_read(
        """
        MATCH (:User {id: $teacher_id})-[:TEACHES]->(course:Course)
        OPTIONAL MATCH (cluster:LearningCluster)-[:IN_COURSE]->(course)
        WHERE $cluster_id IS NULL OR cluster.id = $cluster_id
        RETURN course.id AS courseId, cluster.id AS clusterId,
               coalesce(cluster.name, 'Tất cả cụm') AS clusterName
        ORDER BY cluster.sequence
        LIMIT 1
        """,
        {"teacher_id": user["id"], "cluster_id": cluster_id},
    )
    if not course_filter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khóa học hoặc cụm.")
    data = course_filter[0]
    students = run_read(
        """
        MATCH (student:User {role: 'student'})-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(:Course {id: $course_id})
        MATCH (node:LearningNode)-[:IN_COURSE]->(:Course {id: $course_id})
        WHERE $cluster_id IS NULL OR EXISTS {
          MATCH (node)-[:IN_CLUSTER]->(:LearningCluster {id: $cluster_id})
        }
        OPTIONAL MATCH (student)-[progress:HAS_PROGRESS]->(node)
        WITH student, avg(coalesce(progress.mastery, 0)) AS mastery
        RETURN student.name AS name, student.id AS id, mastery
        ORDER BY mastery
        LIMIT 50
        """,
        {"course_id": data["courseId"], "cluster_id": data["clusterId"]},
    )
    total = len(students)
    struggling = [student for student in students if student["mastery"] < 50]
    return {
        "cluster": data["clusterName"],
        "node": "",
        "struggling": len(struggling),
        "total": total,
        "students": [
            {
                "name": student["name"],
                "initials": "".join(part[0] for part in student["name"].split()[-2:]).upper(),
                "meta": student["id"],
                "percent": round(student["mastery"]),
            }
            for student in struggling
        ],
    }


@router.get("/courses/{course_id}/learning-outcomes/chains")
def get_course_learning_outcome_chains(course_id: str, user: CurrentUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    rows = run_read(
        """
        MATCH (outcome:LearningOutcome)-[:IN_COURSE]->(:Course {id: $course_id})
        OPTIONAL MATCH (node:LearningNode)-[:ALIGNS_WITH]->(outcome)
        RETURN outcome.id AS lo, coalesce(outcome.title, outcome.description, outcome.id) AS title,
               coalesce(outcome.sequence, 0) AS sequence,
               [n IN collect(DISTINCT node.title) WHERE n IS NOT NULL] AS steps,
               coalesce(outcome.endLabel, outcome.title, outcome.id) AS end
        ORDER BY sequence
        """,
        {"course_id": course_id},
    )
    return rows


@router.get("/teacher/courses/{course_id}/learning-outcomes/chains")
def get_learning_outcome_chains(course_id: str, user: TeacherUser) -> list[dict[str, Any]]:
    return get_course_learning_outcome_chains(course_id, user)


@router.post("/teacher/courses/{course_id}/graph/nodes", status_code=status.HTTP_201_CREATED)
def create_graph_node(
    course_id: str,
    request: CreateGraphNodeRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    node_id = f"{request.nodeType.lower()}_{uuid4().hex[:10]}"
    label_map = {
        "LO": "LearningOutcome",
        "Concept": "LearningNode",
        "Assignment": "Assignment",
        "Item": "QuizQuestion",
        "Content": "LearningResource",
        "Course": "LearningNode",
    }
    neo4j_label = label_map.get(request.nodeType, "LearningNode")
    extra_props = {
        k: v for k, v in (request.properties or {}).items() if isinstance(v, (str, int, float, bool, list))
    }
    run_write(
        f"""
        MATCH (course:Course {{id: $course_id}})
        CREATE (node:{neo4j_label} {{
          id: $id, name: $name, title: $name, nodeType: $node_type, description: $description,
          status: 'approved', x: $x, y: $y, lo: $lo, sequence: 999
        }})
        SET node += $extra_props
        CREATE (node)-[:IN_COURSE]->(course)
        FOREACH (_ IN CASE WHEN $node_type = 'LO' THEN [1] ELSE [] END | CREATE (node)-[:DEVELOP]->(course))
        WITH course, node
        OPTIONAL MATCH (parent {{id: $parent_id}})
        WHERE $parent_id IS NOT NULL
          AND (parent.id = $course_id OR (parent)-[:IN_COURSE|FOR_COURSE|DEVELOP*1..2]->(course))
        FOREACH (_ IN CASE WHEN parent IS NOT NULL AND ('LearningOutcome' IN labels(parent) OR 'LO' IN labels(parent)) THEN [1] ELSE [] END |
          MERGE (node)-[:DEVELOP]->(parent)
        )
        FOREACH (_ IN CASE WHEN parent IS NOT NULL AND NOT ('LearningOutcome' IN labels(parent) OR 'LO' IN labels(parent)) AND parent.id <> $course_id THEN [1] ELSE [] END |
          MERGE (node)-[:PART_OF]->(parent)
        )
        RETURN node.id AS id
        """,
        {
            "course_id": course_id,
            "parent_id": request.clusterId,
            "id": node_id,
            "name": request.name,
            "node_type": request.nodeType,
            "description": request.description,
            "x": request.x,
            "y": request.y,
            "lo": request.lo,
            "extra_props": extra_props,
        },
    )
    return {
        "id": node_id,
        "name": request.name,
        "type": request.nodeType,
        "description": request.description,
        "properties": {"status": "approved", **extra_props},
    }


@router.patch("/teacher/courses/{course_id}/graph/nodes/{node_id}")
def update_graph_node(
    course_id: str,
    node_id: str,
    request: UpdateGraphNodeRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    updates: dict[str, Any] = {}
    if request.name is not None:
        updates["name"] = request.name.strip()
        updates["title"] = request.name.strip()
    if request.description is not None:
        updates["description"] = request.description.strip()
    if request.status is not None:
        updates["status"] = request.status
    if request.approved is not None:
        updates["approved"] = request.approved
        if request.approved:
            updates["status"] = "approved"
    if request.x is not None:
        updates["x"] = request.x
    if request.y is not None:
        updates["y"] = request.y
    if request.lo is not None:
        updates["lo"] = request.lo
    if request.properties is not None:
        for k, v in request.properties.items():
            if isinstance(v, (str, int, float, bool, list)):
                updates[k] = v

    rows = run_write(
        """
        MATCH (target {id: $node_id})-[:IN_COURSE|FOR_COURSE|DEVELOP*1..2]->(:Course {id: $course_id})
        SET target += $updates
        RETURN properties(target) AS item
        LIMIT 1
        """,
        {"course_id": course_id, "node_id": node_id, "updates": updates},
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy node hoặc cụm.")
    return rows[0]["item"]


@router.delete("/teacher/courses/{course_id}/graph/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_graph_node(course_id: str, node_id: str, user: TeacherUser) -> Response:
    _course_access(course_id, user)
    if node_id == course_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Không thể xóa node gốc của khóa học.")
    deleted = run_write(
        """
        MATCH (target {id: $node_id})-[:IN_COURSE|FOR_COURSE|DEVELOP*1..2]->(:Course {id: $course_id})
        DETACH DELETE target
        RETURN $node_id AS id
        """,
        {"course_id": course_id, "node_id": node_id},
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy node hoặc cụm.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/teacher/courses/{course_id}/graph/edges", status_code=status.HTTP_201_CREATED)
def create_graph_edge(
    course_id: str,
    request: CreateGraphEdgeRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    if request.fromId == request.toId:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Không thể nối cạnh tới chính node đó.")
    rel_map = {
        "prereq": "PREREQUISITE",
        "related": "RELATED_TO",
        "concept": "RELATED_TO",
        "PREREQUISITE": "PREREQUISITE",
        "PART_OF": "PART_OF",
        "RELATED_TO": "RELATED_TO",
        "DEVELOP": "DEVELOP",
        "EXPLAIN": "EXPLAIN",
        "ASSESS": "ASSESS",
    }
    rel_type = rel_map[request.kind]
    edge_props = {
        k: v for k, v in (request.properties or {}).items() if isinstance(v, (str, int, float, bool, list))
    }
    edge_props.setdefault("status", "approved")
    rows = run_write(
        f"""
        MATCH (course:Course {{id: $course_id}})
        MATCH (source {{id: $from_id}})
        WHERE source.id = $course_id OR (source)-[:IN_COURSE|FOR_COURSE|DEVELOP*1..2]->(course)
        MATCH (target {{id: $to_id}})
        WHERE target.id = $course_id OR (target)-[:IN_COURSE|FOR_COURSE|DEVELOP*1..2]->(course)
        MERGE (source)-[rel:{rel_type}]->(target)
        SET rel += $edge_props
        RETURN source.id AS source, target.id AS target
        """,
        {
            "course_id": course_id,
            "from_id": request.fromId,
            "to_id": request.toId,
            "edge_props": edge_props,
        },
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy node nguồn hoặc node đích trong khóa học.")
    return {
        "from": request.fromId,
        "to": request.toId,
        "source": request.fromId,
        "target": request.toId,
        "kind": request.kind,
        "type": rel_type,
        "properties": edge_props,
    }


@router.delete("/teacher/courses/{course_id}/graph/edges", status_code=status.HTTP_204_NO_CONTENT)
def delete_graph_edge(
    course_id: str,
    request: DeleteGraphEdgeRequest,
    user: TeacherUser,
) -> Response:
    _course_access(course_id, user)
    run_write(
        """
        MATCH (course:Course {id: $course_id})
        MATCH (source {id: $from_id})-[rel:REQUIRES|PREREQUISITE|PART_OF|IN_CLUSTER|RELATED|RELATED_TO|CONCEPT|ALIGNS_WITH|DEVELOP|EXPLAIN|ASSESS]->(target {id: $to_id})
        WHERE (source.id = $course_id OR (source)-[:IN_COURSE|FOR_COURSE|DEVELOP*1..2]->(course))
          AND (target.id = $course_id OR (target)-[:IN_COURSE|FOR_COURSE|DEVELOP*1..2]->(course))
          AND ($edge_type IS NULL OR type(rel) = $edge_type)
        DELETE rel
        RETURN count(rel) AS deleted
        """,
        {
            "course_id": course_id,
            "from_id": request.fromId,
            "to_id": request.toId,
            "edge_type": request.edgeType,
        },
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/teacher/courses/{course_id}/graph/edges/approve", status_code=status.HTTP_200_OK)
def approve_graph_edge(
    course_id: str,
    request: ApproveGraphEdgeRequest,
    user: TeacherUser,
) -> dict[str, Any]:
    _course_access(course_id, user)
    rows = run_write(
        """
        MATCH (course:Course {id: $course_id})
        MATCH (source {id: $from_id})-[rel:REQUIRES|PREREQUISITE|PART_OF|IN_CLUSTER|RELATED|RELATED_TO|CONCEPT|ALIGNS_WITH|DEVELOP|EXPLAIN|ASSESS]->(target {id: $to_id})
        WHERE (source.id = $course_id OR (source)-[:IN_COURSE|FOR_COURSE|DEVELOP*1..2]->(course))
          AND (target.id = $course_id OR (target)-[:IN_COURSE|FOR_COURSE|DEVELOP*1..2]->(course))
          AND ($edge_type IS NULL OR type(rel) = $edge_type)
        SET rel.status = 'approved', rel.confidence = 1.0
        RETURN source.id AS source, target.id AS target, type(rel) AS type
        """,
        {
            "course_id": course_id,
            "from_id": request.fromId,
            "to_id": request.toId,
            "edge_type": request.edgeType,
        },
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cạnh cần duyệt.")
    return rows[0]


@router.post("/teacher/courses/{course_id}/graph/nodes/merge", status_code=status.HTTP_200_OK)
def merge_graph_nodes(
    course_id: str,
    request: MergeGraphNodesRequest,
    user: TeacherUser,
) -> dict[str, str]:
    _course_access(course_id, user)
    if request.keepId == request.mergeId:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Hai node cần gộp phải khác nhau.")
    rows = run_write(
        """
        MATCH (course:Course {id: $course_id})
        MATCH (keep {id: $keep_id})
        WHERE keep.id = $course_id OR (keep)-[:IN_COURSE|FOR_COURSE|DEVELOP*1..2]->(course)
        MATCH (dup {id: $merge_id})
        WHERE (dup)-[:IN_COURSE|FOR_COURSE|DEVELOP*1..2]->(course)
        OPTIONAL MATCH (src)-[r_in:REQUIRES|PREREQUISITE]->(dup)
        WHERE src.id <> keep.id
        FOREACH (_ IN CASE WHEN src IS NULL THEN [] ELSE [1] END | MERGE (src)-[:PREREQUISITE]->(keep))
        WITH keep, dup
        OPTIONAL MATCH (dup)-[r_out:REQUIRES|PREREQUISITE]->(dst)
        WHERE dst.id <> keep.id
        FOREACH (_ IN CASE WHEN dst IS NULL THEN [] ELSE [1] END | MERGE (keep)-[:PREREQUISITE]->(dst))
        WITH keep, dup
        OPTIONAL MATCH (child)-[r_part:PART_OF|IN_CLUSTER]->(dup)
        WHERE child.id <> keep.id
        FOREACH (_ IN CASE WHEN child IS NULL THEN [] ELSE [1] END | MERGE (child)-[:PART_OF]->(keep))
        WITH keep, dup
        OPTIONAL MATCH (dup)-[:DEVELOP|ALIGNS_WITH]->(lo)
        WHERE lo.id <> keep.id
        FOREACH (_ IN CASE WHEN lo IS NULL THEN [] ELSE [1] END | MERGE (keep)-[:DEVELOP]->(lo))
        SET keep.merged_from = coalesce(keep.merged_from, []) + [coalesce(dup.name, dup.title, dup.id)]
        DETACH DELETE dup
        RETURN keep.id AS id
        """,
        {"course_id": course_id, "keep_id": request.keepId, "merge_id": request.mergeId},
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy node để gộp.")
    return {"id": request.keepId}



@router.get("/teacher/nodes/{node_id}")
def get_node_editor(node_id: str, user: TeacherUser) -> dict[str, Any]:
    records = run_read(
        """
        MATCH (node:LearningNode {id: $node_id})-[:IN_COURSE]->(course:Course)
        OPTIONAL MATCH (node)-[:IN_CLUSTER]->(cluster:LearningCluster)
        OPTIONAL MATCH (node)-[:REQUIRES]->(prerequisite:LearningNode)
        OPTIONAL MATCH (node)-[:HAS_RESOURCE]->(resource:LearningResource)
        OPTIONAL MATCH (node)-[:HAS_QUIZ]->(quiz:Quiz)
        OPTIONAL MATCH (quiz_question:QuizQuestion)-[:PART_OF]->(quiz)
        RETURN properties(node) AS node, course.id AS courseId, course.title AS courseTitle,
               cluster.name AS cluster, collect(DISTINCT prerequisite.title) AS prerequisites,
               collect(DISTINCT CASE WHEN resource IS NULL THEN null ELSE {
                 id: resource.id, kind: resource.kind, title: resource.nameVi, source: resource.url
               } END) AS contents,
               collect(DISTINCT CASE WHEN quiz_question IS NULL THEN null ELSE {
                 id: quiz_question.id, text: quiz_question.prompt,
                 bloom: coalesce(quiz_question.bloom, ''), difficulty: coalesce(quiz_question.difficulty, ''),
                 status: coalesce(quiz_question.status, 'approved')
               } END) AS questions
        LIMIT 1
        """,
        {"node_id": node_id},
    )
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy node.")
    record = records[0]
    _course_access(record["courseId"], user)
    node = record["node"]
    return {
        "id": node_id,
        "name": node.get("title", ""),
        "course": record["courseTitle"],
        "group": node.get("groupName", ""),
        "parentNode": node.get("parentNode", ""),
        "cluster": record.get("cluster") or "",
        "description": node.get("description", ""),
        "contents": [item for item in record["contents"] if item],
        "questions": [item for item in record["questions"] if item],
        "prerequisites": [item for item in record["prerequisites"] if item],
    }

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import require_roles
from app.api.routes.courses import _course_access
from app.infrastructure.neo4j.driver import run_read

router = APIRouter(tags=["Learning graph"])
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


@router.get("/teacher/courses/{course_id}/graph")
def get_teacher_graph(course_id: str, user: TeacherUser) -> dict[str, Any]:
    _course_access(course_id, user)
    clusters = run_read(
        """
        MATCH (cluster:LearningCluster)-[:IN_COURSE]->(:Course {id: $course_id})
        OPTIONAL MATCH (node:LearningNode)-[:IN_CLUSTER]->(cluster)
        OPTIONAL MATCH (node)-[:ALIGNS_WITH]->(outcome:LearningOutcome)
        WITH cluster, collect(DISTINCT node) AS nodes, collect(DISTINCT outcome.id) AS outcomes
        RETURN cluster.id AS id, coalesce(cluster.sequence, 0) AS index,
               cluster.name AS name, size(nodes) AS nodeCount,
               coalesce(cluster.x, 0) AS x, coalesce(cluster.y, 0) AS y,
               [outcome IN outcomes WHERE outcome IS NOT NULL] AS lo,
               cluster.approved AS approved,
               coalesce(cluster.struggle, 0) AS struggle
        ORDER BY cluster.sequence
        """,
        {"course_id": course_id},
    )
    edges = run_read(
        """
        MATCH (source:LearningCluster)-[:RELATED_TO]->(target:LearningCluster)
        MATCH (source)-[:IN_COURSE]->(:Course {id: $course_id})
        RETURN source.id AS from, target.id AS to, 'related' AS kind
        """,
        {"course_id": course_id},
    )
    stats = run_read(
        """
        MATCH (course:Course {id: $course_id})
        OPTIONAL MATCH (node:LearningNode)-[:IN_COURSE]->(course)
        WITH course, count(node) AS nodeCount,
             count(CASE WHEN node.status = 'draft' OR node.status = 'pending_review' THEN 1 END) AS drafts
        OPTIONAL MATCH (source:LearningNode)-[edge:REQUIRES|RELATED|CONCEPT]->(target:LearningNode)
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
    nodes = run_read(
        """
        MATCH (node:LearningNode)-[:IN_CLUSTER]->(:LearningCluster {id: $cluster_id})
        OPTIONAL MATCH (node)-[:ALIGNS_WITH]->(outcome:LearningOutcome)
        OPTIONAL MATCH (node)-[:HAS_RESOURCE]->(resource:LearningResource)
        OPTIONAL MATCH (node)-[:HAS_QUIZ]->(quiz:Quiz)
        RETURN node.id AS id, node.title AS name, coalesce(node.status, 'approved') AS status,
               coalesce(node.x, 0) AS x, coalesce(node.y, 0) AS y,
               collect(DISTINCT outcome.id) AS lo,
               count(DISTINCT resource) AS contents, count(DISTINCT quiz) AS questions
        ORDER BY node.sequence
        """,
        {"cluster_id": cluster_id},
    )
    edges = run_read(
        """
        MATCH (source:LearningNode)-[relationship:REQUIRES|RELATED|CONCEPT]->(target:LearningNode)
        WHERE (source)-[:IN_CLUSTER]->(:LearningCluster {id: $cluster_id})
          AND (target)-[:IN_CLUSTER]->(:LearningCluster {id: $cluster_id})
        RETURN source.id AS from, target.id AS to,
               CASE type(relationship) WHEN 'REQUIRES' THEN 'prereq' ELSE 'related' END AS kind
        """,
        {"cluster_id": cluster_id},
    )
    return {"nodes": [_teacher_node(node) for node in nodes], "edges": edges}


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


@router.get("/teacher/courses/{course_id}/learning-outcomes/chains")
def get_learning_outcome_chains(course_id: str, user: TeacherUser) -> list[dict[str, Any]]:
    _course_access(course_id, user)
    return run_read(
        """
        MATCH (outcome:LearningOutcome)-[:IN_COURSE]->(:Course {id: $course_id})
        OPTIONAL MATCH (node:LearningNode)-[:ALIGNS_WITH]->(outcome)
        RETURN outcome.id AS id, outcome.title AS title, outcome.sequence AS sequence,
               collect(node.id) AS nodeIds
        ORDER BY outcome.sequence
        """,
        {"course_id": course_id},
    )


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

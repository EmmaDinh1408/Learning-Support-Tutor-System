MATCH (student:User {id: $student_id, role: 'student'})-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(course:Course {id: $course_id})
MATCH (node:LearningNode)-[:IN_COURSE]->(course)
OPTIONAL MATCH (student)-[progress:HAS_PROGRESS]->(node)
OPTIONAL MATCH (node)-[:REQUIRES]->(prereq:LearningNode)
OPTIONAL MATCH (student)-[prereq_progress:HAS_PROGRESS]->(prereq)
OPTIONAL MATCH (node)-[:IN_CLUSTER]->(cluster:LearningCluster)
OPTIONAL MATCH (node)-[:ALIGNS_WITH]->(lo:LearningOutcome)
WITH node, cluster, lo,
     coalesce(progress.mastery, 0) AS mastery,
     collect(DISTINCT CASE WHEN prereq IS NULL THEN null ELSE {
       id: prereq.id,
       title: prereq.title,
       mastery: coalesce(prereq_progress.mastery, 0),
       ready: coalesce(prereq_progress.mastery, 0) >= 80
     } END) AS prerequisites
WHERE mastery < 80
RETURN node.id AS nodeId,
       node.title AS title,
       coalesce(node.subtitle, '') AS subtitle,
       coalesce(cluster.name, '') AS clusterName,
       coalesce(lo.id, node.learningOutcomeId, '') AS learningOutcomeId,
       mastery AS currentMastery,
       coalesce(node.aiHint, '') AS aiHint,
       [item IN prerequisites WHERE item IS NOT NULL] AS prerequisites
ORDER BY mastery ASC, node.sequence ASC
LIMIT $limit

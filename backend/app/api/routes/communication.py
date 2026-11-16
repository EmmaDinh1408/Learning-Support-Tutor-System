from datetime import datetime, timezone
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import get_current_user
from app.domain.models.api import CreateConversationRequest, SendMessageRequest
from app.infrastructure.neo4j.driver import run_read, run_write

router = APIRouter(tags=["Communication"])
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def _initials(name: str) -> str:
    return "".join(part[0] for part in name.split()[-2:] if part).upper()


def _conversation_summaries(user_id: str) -> list[dict[str, Any]]:
    records = run_read(
        """
        MATCH (current:User {id: $user_id})-[:PARTICIPATES_IN]->(conversation:Conversation)
        MATCH (other:User)-[:PARTICIPATES_IN]->(conversation)
        WHERE other.id <> current.id
        OPTIONAL MATCH (conversation)-[:HAS_MESSAGE]->(message:Message)
        WITH current, conversation, other, message
        ORDER BY message.sentAt DESC
        WITH current, conversation, other, collect(message)[0] AS latest
        OPTIONAL MATCH (conversation)-[:HAS_MESSAGE]->(unread:Message)
        WHERE unread.senderId <> current.id AND NOT current.id IN coalesce(unread.readByIds, [])
        RETURN conversation.id AS id, other.id AS participantId, other.name AS participantName,
               conversation.courseCode AS courseCode,
               coalesce(latest.body, '') AS lastMessage,
               coalesce(latest.sentAt, conversation.createdAt) AS lastMessageAt,
               count(unread) AS unreadCount
        ORDER BY lastMessageAt DESC
        """,
        {"user_id": user_id},
    )
    return [
        {
            **record,
            "initials": _initials(record["participantName"]),
            "unreadCount": int(record["unreadCount"]),
        }
        for record in records
    ]


def _ensure_member(conversation_id: str, user_id: str) -> None:
    result = run_read(
        """
        MATCH (:User {id: $user_id})-[:PARTICIPATES_IN]->(:Conversation {id: $conversation_id})
        RETURN 1 AS member LIMIT 1
        """,
        {"user_id": user_id, "conversation_id": conversation_id},
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cuộc trò chuyện.")


@router.get("/notifications")
def get_notifications(user: CurrentUser) -> list[dict[str, Any]]:
    return run_read(
        """
        MATCH (user:User {id: $user_id})-[:HAS_NOTIFICATION]->(notification:Notification)
        RETURN notification.id AS id, notification.title AS title,
               notification.description AS description, notification.createdAt AS time,
               coalesce(notification.read, false) AS read
        ORDER BY notification.createdAt DESC
        LIMIT 100
        """,
        {"user_id": user["id"]},
    )


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_notifications_read(user: CurrentUser) -> Response:
    run_write(
        """
        MATCH (:User {id: $user_id})-[:HAS_NOTIFICATION]->(notification:Notification)
        SET notification.read = true
        RETURN count(notification) AS updated
        """,
        {"user_id": user["id"]},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/conversations/contacts")
def get_contacts(user: CurrentUser) -> list[dict[str, Any]]:
    records = run_read(
        """
        MATCH (current:User {id: $user_id})
        MATCH (other:User {active: true})
        WHERE other.id <> current.id
        OPTIONAL MATCH (current)-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(student_course:Course)<-[:TEACHES]-(other)
        OPTIONAL MATCH (other)-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(teacher_course:Course)<-[:TEACHES]-(current)
        WITH current, other, coalesce(student_course, teacher_course) AS shared_course
        WHERE current.role = 'admin' OR shared_course IS NOT NULL
        RETURN other.id AS id, other.name AS name, other.role AS role,
               shared_course.code AS courseCode
        ORDER BY other.name
        """,
        {"user_id": user["id"]},
    )
    return [{**record, "initials": _initials(record["name"])} for record in records]


@router.get("/conversations")
def get_conversations(user: CurrentUser) -> list[dict[str, Any]]:
    return [
        {
            **record,
            "initials": _initials(record["participantName"]),
        }
        for record in _conversation_summaries(str(user["id"]))
    ]


@router.get("/messages")
def get_message_previews(user: CurrentUser) -> list[dict[str, Any]]:
    return [
        {
            "id": record["id"],
            "initials": record["initials"],
            "sender": record["participantName"],
            "time": record["lastMessageAt"],
            "preview": record["lastMessage"],
            "unread": record["unreadCount"] > 0,
        }
        for record in get_conversations(user)
    ]


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
def create_conversation(request: CreateConversationRequest, user: CurrentUser) -> dict[str, Any]:
    contact = run_read(
        """
        MATCH (current:User {id: $user_id})
        MATCH (other:User {id: $recipient_id, active: true})
        WHERE current.id <> other.id
        OPTIONAL MATCH (current)-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(student_course:Course)<-[:TEACHES]-(other)
        OPTIONAL MATCH (other)-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(teacher_course:Course)<-[:TEACHES]-(current)
        WITH other, coalesce(student_course, teacher_course) AS shared_course, current
        WHERE current.role = 'admin' OR shared_course IS NOT NULL
        RETURN other.id AS id, other.name AS name, shared_course.code AS courseCode
        LIMIT 1
        """,
        {"user_id": user["id"], "recipient_id": request.recipientId},
    )
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người nhận không khả dụng.")
    conversation_id = f"conversation_{uuid4().hex}"
    message_id = f"message_{uuid4().hex}"
    now = datetime.now(timezone.utc).isoformat()
    run_write(
        """
        MATCH (sender:User {id: $sender_id})
        MATCH (recipient:User {id: $recipient_id})
        CREATE (conversation:Conversation {id: $conversation_id, createdAt: $sent_at, courseCode: $course_code})
        CREATE (sender)-[:PARTICIPATES_IN]->(conversation)
        CREATE (recipient)-[:PARTICIPATES_IN]->(conversation)
        CREATE (message:Message {
          id: $message_id, conversationId: $conversation_id, senderId: sender.id,
          senderName: sender.name, body: $body, sentAt: $sent_at, readByIds: [sender.id]
        })
        CREATE (conversation)-[:HAS_MESSAGE]->(message)
        CREATE (message)-[:SENT_BY]->(sender)
        SET conversation.updatedAt = $sent_at
        RETURN conversation.id AS id
        """,
        {
            "sender_id": user["id"],
            "recipient_id": request.recipientId,
            "conversation_id": conversation_id,
            "message_id": message_id,
            "sent_at": now,
            "course_code": contact[0]["courseCode"],
            "body": request.message,
        },
    )
    summary = next(item for item in _conversation_summaries(str(user["id"])) if item["id"] == conversation_id)
    return summary


@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: str, user: CurrentUser) -> list[dict[str, Any]]:
    _ensure_member(conversation_id, str(user["id"]))
    return run_read(
        """
        MATCH (:Conversation {id: $conversation_id})-[:HAS_MESSAGE]->(message:Message)
        RETURN message.id AS id, message.conversationId AS conversationId,
               message.senderId AS senderId, message.senderName AS senderName,
               message.body AS body, message.sentAt AS sentAt
        ORDER BY message.sentAt
        """,
        {"conversation_id": conversation_id},
    )


@router.post("/conversations/{conversation_id}/messages", status_code=status.HTTP_201_CREATED)
def send_message(conversation_id: str, request: SendMessageRequest, user: CurrentUser) -> dict[str, Any]:
    _ensure_member(conversation_id, str(user["id"]))
    message_id = f"message_{uuid4().hex}"
    sent_at = datetime.now(timezone.utc).isoformat()
    records = run_write(
        """
        MATCH (sender:User {id: $sender_id})-[:PARTICIPATES_IN]->(conversation:Conversation {id: $conversation_id})
        CREATE (message:Message {
          id: $message_id, conversationId: $conversation_id, senderId: sender.id,
          senderName: sender.name, body: $body, sentAt: $sent_at, readByIds: [sender.id]
        })
        CREATE (conversation)-[:HAS_MESSAGE]->(message)
        CREATE (message)-[:SENT_BY]->(sender)
        SET conversation.updatedAt = $sent_at
        RETURN message.id AS id, message.conversationId AS conversationId,
               message.senderId AS senderId, message.senderName AS senderName,
               message.body AS body, message.sentAt AS sentAt
        """,
        {
            "sender_id": user["id"],
            "conversation_id": conversation_id,
            "message_id": message_id,
            "body": request.body,
            "sent_at": sent_at,
        },
    )
    if not records:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cuộc trò chuyện.")
    return records[0]


@router.patch("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_conversation_read(conversation_id: str, user: CurrentUser) -> Response:
    _ensure_member(conversation_id, str(user["id"]))
    run_write(
        """
        MATCH (:Conversation {id: $conversation_id})-[:HAS_MESSAGE]->(message:Message)
        WHERE message.senderId <> $user_id
        SET message.readByIds = CASE
          WHEN $user_id IN coalesce(message.readByIds, []) THEN coalesce(message.readByIds, [])
          ELSE coalesce(message.readByIds, []) + $user_id
        END
        RETURN count(message) AS updated
        """,
        {"conversation_id": conversation_id, "user_id": user["id"]},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

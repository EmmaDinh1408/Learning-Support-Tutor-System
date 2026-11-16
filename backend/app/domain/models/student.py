from pydantic import BaseModel, Field


class KnowledgeGapItem(BaseModel):
    id: str
    title: str
    courseId: str
    courseCode: str
    cluster: str = ""
    mastery: float = Field(default=0, ge=0, le=100)
    lo: str = ""


class RecommendationCandidate(BaseModel):
    nodeId: str
    title: str
    subtitle: str = ""
    clusterName: str = ""
    learningOutcomeId: str = ""
    currentMastery: float = Field(default=0, ge=0, le=100)
    aiHint: str = ""
    score: float = Field(default=0, ge=0, le=1)
    reason: str = ""

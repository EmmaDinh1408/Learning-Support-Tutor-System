from typing import Any


def score_recommendation_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    mastery = float(candidate.get("currentMastery") or 0.0)
    prereqs = candidate.get("prerequisites") or []
    ready_count = sum(1 for item in prereqs if item.get("ready", True))
    prereq_readiness = ready_count / len(prereqs) if prereqs else 1.0
    gap_weight = max(0.0, (80.0 - mastery) / 80.0)
    score = round(min(1.0, 0.65 * gap_weight + 0.35 * prereq_readiness), 2)
    if mastery == 0 and prereq_readiness >= 1.0:
        reason = "Sẵn sàng học mới — đã hoàn thành các kiến thức tiền đề."
    elif prereq_readiness < 1.0:
        reason = "Cần củng cố các node tiền đề trước khi đi sâu vào chủ đề này."
    else:
        reason = f"Độ thành thạo hiện tại {round(mastery)}% — nên ôn luyện để đạt chuẩn đầu ra."
    return {
        **candidate,
        "score": score,
        "reason": reason,
    }


def rank_recommendations(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    scored = [score_recommendation_candidate(item) for item in candidates]
    return sorted(scored, key=lambda item: (-float(item["score"]), float(item.get("currentMastery") or 0)))

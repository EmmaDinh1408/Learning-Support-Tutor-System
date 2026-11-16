from app.application.services.ranking_service import rank_recommendations, score_recommendation_candidate


def test_score_recommendation_prioritizes_ready_prereqs_and_low_mastery() -> None:
    ready_node = {
        "nodeId": "n1",
        "title": "TCP Flow Control",
        "currentMastery": 20,
        "prerequisites": [{"id": "p1", "title": "Sockets", "mastery": 90, "ready": True}],
    }
    blocked_node = {
        "nodeId": "n2",
        "title": "Congestion Control",
        "currentMastery": 20,
        "prerequisites": [{"id": "p2", "title": "Flow Control", "mastery": 30, "ready": False}],
    }
    scored_ready = score_recommendation_candidate(ready_node)
    scored_blocked = score_recommendation_candidate(blocked_node)

    assert scored_ready["score"] > scored_blocked["score"]
    ranked = rank_recommendations([blocked_node, ready_node])
    assert ranked[0]["nodeId"] == "n1"

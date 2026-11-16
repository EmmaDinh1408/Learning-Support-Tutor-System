from app.application.services.recommendation_service import build_course_recommendations


def test_build_course_recommendations_orders_and_limits_results(monkeypatch) -> None:
    sample = [
        {
            "nodeId": "n2",
            "title": "Node 2",
            "currentMastery": 60,
            "prerequisites": [],
        },
        {
            "nodeId": "n1",
            "title": "Node 1",
            "currentMastery": 10,
            "prerequisites": [{"id": "p0", "title": "Intro", "mastery": 85, "ready": True}],
        },
    ]
    monkeypatch.setattr(
        "app.application.services.recommendation_service.get_student_recommendations",
        lambda student_id, course_id, limit=12: sample,
    )
    results = build_course_recommendations("usr_1", "CO3093", limit=1)
    assert len(results) == 1
    assert results[0]["nodeId"] == "n1"
    assert results[0]["score"] > 0

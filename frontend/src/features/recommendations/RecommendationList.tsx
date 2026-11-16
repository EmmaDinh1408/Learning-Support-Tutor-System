import { Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAsync } from '../common/useAsync';
import { useLanguage } from '../i18n/LanguageContext';

export function RecommendationList({ courseId }: { courseId: string }) {
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(
    () => api.getCourseRecommendations(courseId),
    [courseId],
  );
  const recommendations = data ?? [];

  if (loading) {
    return <p className="muted">{isVi ? 'Đang phân tích gợi ý học tập...' : 'Loading recommendations...'}</p>;
  }
  if (error) {
    return <p className="form-error" role="alert">{error.message}</p>;
  }

  return (
    <section className="dashboard-section">
      <div className="dashboard-section-header">
        <h2>
          <Sparkles size={17} />
          {isVi ? 'Gợi ý học tập cá nhân hóa từ Knowledge Graph' : 'Personalized Knowledge Graph Recommendations'}
        </h2>
      </div>
      {recommendations.length === 0 ? (
        <p className="muted" style={{ marginTop: 8 }}>
          {isVi ? 'Bạn đã hoàn thành tốt tất cả các chủ đề trong học phần này!' : 'You have mastered all topics in this course!'}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {recommendations.map((rec) => (
            <article
              key={rec.nodeId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: 10,
                background: 'var(--surface-muted, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <strong>{rec.title}</strong>
                  {rec.learningOutcomeId && (
                    <span className="assignment-status published">{rec.learningOutcomeId}</span>
                  )}
                  <span className="muted-s">
                    Mastery: {rec.currentMastery}% · Score: {Math.round(rec.score * 100)}%
                  </span>
                </div>
                <p style={{ margin: '4px 0', fontSize: 13 }}>{rec.reason}</p>
                {rec.aiHint && <p className="muted-s" style={{ margin: 0 }}>{rec.aiHint}</p>}
              </div>
              <button
                type="button"
                className="btn btn-primary sm"
                onClick={() => navigate(`/courses/${courseId}/graph`)}
              >
                {isVi ? 'Học ngay' : 'Study now'} <ArrowRight size={13} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default RecommendationList;

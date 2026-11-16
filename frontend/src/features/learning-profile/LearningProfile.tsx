import { TrendingUp, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { useAsync } from '../common/useAsync';
import { ProgressBar } from '../common/ProgressBar';
import { useLanguage } from '../i18n/LanguageContext';

export function LearningProfile({ courseId }: { courseId?: string }) {
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const { data, loading, error } = useAsync(
    () => api.getStudentLearningProfile(courseId),
    [courseId],
  );

  if (loading) {
    return <p className="muted">{isVi ? 'Đang tải hồ sơ năng lực...' : 'Loading learning profile...'}</p>;
  }
  if (error) {
    return <p className="form-error" role="alert">{error.message}</p>;
  }
  if (!data) return null;

  return (
    <section className="dashboard-section" style={{ marginBottom: 16 }}>
      <div className="dashboard-section-header">
        <h2>
          <TrendingUp size={17} />
          {isVi ? 'Hồ sơ Năng lực & Lỗ hổng Kiến thức' : 'Learning Profile & Knowledge Gaps'}
        </h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
        {data.courses.map((course) => (
          <div
            key={course.courseId}
            style={{
              padding: 12,
              borderRadius: 10,
              background: 'var(--surface-muted, #f8fafc)',
              border: '1px solid var(--border, #e2e8f0)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <strong>{course.courseCode}</strong>
              <span>{course.progress}%</span>
            </div>
            <p className="muted-s" style={{ marginBottom: 8 }}>{course.courseTitle}</p>
            <ProgressBar value={course.progress} />
            <p className="muted-s" style={{ marginTop: 6 }}>
              {course.masteredNodes}/{course.totalNodes} {isVi ? 'chủ đề đạt chuẩn' : 'nodes mastered'}
            </p>
          </div>
        ))}
      </div>

      {data.knowledgeGaps.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <AlertCircle size={15} />
            {isVi ? 'Các chủ đề cần củng cố (Mastery < 80%)' : 'Topics needing reinforcement (Mastery < 80%)'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {data.knowledgeGaps.map((gap) => (
              <div
                key={gap.id}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{gap.title}</strong>
                  <span>{gap.mastery}%</span>
                </div>
                <span className="muted-s">{gap.cluster} · {gap.lo}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default LearningProfile;

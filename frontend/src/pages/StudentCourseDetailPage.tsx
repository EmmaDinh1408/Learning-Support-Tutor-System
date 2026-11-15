import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bell, CalendarCheck, ChevronDown, ChevronRight, ClipboardList, Edit3, FileText, Sigma, Users } from 'lucide-react';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { useAsync } from '../features/common/useAsync';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { CourseSection } from '../types';

type DetailTab = 'personalized' | 'content' | 'grades';

export default function StudentCourseDetailPage() {
  const { courseId = '', tab = 'content' } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ materials: true, ch0: true });
  const isVi = language === 'vi';
  const { data: courseData, error: coursesError } = useAsync(() => api.getStudentCourses(), []);
  const { data: sectionData, loading: sectionsLoading, error: sectionsError } =
    useAsync<CourseSection[]>(() => api.getCourseSections(courseId), [courseId]);
  const { data: gradeData, loading: gradesLoading, error: gradesError } =
    useAsync(() => api.getStudentGrades(courseId), [courseId]);
  const sections = sectionData ?? [];
  const grades = gradeData ?? [];
  const courseName = courseData?.find((course) => course.id === courseId)?.title ?? courseId;

  const tabs: { id: DetailTab | 'graph'; label: string }[] = [
    { id: 'graph', label: isVi ? 'Lộ trình kiến nghị' : 'Recommended path' },
    { id: 'personalized', label: isVi ? 'Lộ trình cá nhân hóa' : 'Personalized path' },
    { id: 'content', label: isVi ? 'Nội dung' : 'Content' },
    { id: 'grades', label: isVi ? 'Điểm số' : 'Grades' },
  ];

  const selectTab = (id: DetailTab | 'graph') => {
    navigate(id === 'graph' ? `/courses/${courseId}/graph` : `/courses/${courseId}/${id}`);
  };
  const totalContribution = grades.reduce((sum, item) => (
    item.score !== null && item.weight !== null ? sum + item.score / item.maxScore * item.weight : sum
  ), 0);

  return (
    <div className="page course-detail-page">
      <AppHeader />
      <main className="container course-detail-content">
        <h1>{courseName}</h1>
        {coursesError && <p className="form-error" role="alert">{coursesError.message}</p>}
        <div className="tabs-pill course-detail-tabs">
          {tabs.map((item) => (
            <button key={item.id} className={tab === item.id ? 'on' : ''} onClick={() => selectTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'content' && (
          <div className="course-detail-sections">
            <section className="course-activity-section" aria-labelledby="course-activity-heading">
              <h2 id="course-activity-heading">{isVi ? 'Hoạt động môn học' : 'Course activities'}</h2>
              <div className="course-activity-links">
                <Link to={`/courses/${courseId}/assignments`}><ClipboardList size={17} />{isVi ? 'Bài tập' : 'Assignments'}<ChevronRight size={15} /></Link>
                <Link to={`/courses/${courseId}/announcements`}><Bell size={17} />{isVi ? 'Thông báo' : 'Announcements'}<ChevronRight size={15} /></Link>
                <Link to={`/courses/${courseId}/quizzes`}><FileText size={17} />{isVi ? 'Quiz và bài kiểm tra' : 'Quizzes and tests'}<ChevronRight size={15} /></Link>
                <Link to={`/courses/${courseId}/attendance`}><CalendarCheck size={17} />{isVi ? 'Điểm danh' : 'Attendance'}<ChevronRight size={15} /></Link>
              </div>
            </section>
            <button className="course-collapse-all" onClick={() => setOpenSections({})}>
              {isVi ? 'Thu gọn toàn bộ' : 'Collapse all'}
            </button>
            {sectionsError && <p className="form-error" role="alert">{sectionsError.message}</p>}
            {sectionsLoading && <p className="muted">{isVi ? 'Đang tải nội dung...' : 'Loading course content...'}</p>}
            {sections.map((section) => {
              const open = openSections[section.id];
              return (
                <div className="course-detail-section" key={section.id}>
                  <button
                    className="course-detail-section-head"
                    aria-expanded={!!open}
                    onClick={() => setOpenSections((current) => ({ ...current, [section.id]: !current[section.id] }))}
                  >
                    <span className="course-section-title">
                      {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      {isVi ? section.titleVi : section.titleEn}
                    </span>
                  </button>
                  {open && (
                    section.items.length ? (
                      <div className="course-resource-list">
                        {section.items.map((item) => (
                          item.kind === 'quiz' ? (
                            <Link to={`/courses/${courseId}/quizzes/${item.id}`} key={item.id} className="course-resource">
                              <FileText size={16} /><span>{isVi ? item.nameVi : item.nameEn}</span><small>{item.kind.toUpperCase()}</small>
                            </Link>
                          ) : item.url ? (
                            <a href={item.url} key={item.id} className="course-resource" target="_blank" rel="noreferrer">
                              <FileText size={16} /><span>{isVi ? item.nameVi : item.nameEn}</span><small>{item.kind.toUpperCase()}</small>
                            </a>
                          ) : (
                            <div key={item.id} className="course-resource">
                              <FileText size={16} /><span>{isVi ? item.nameVi : item.nameEn}</span><small>{item.kind.toUpperCase()}</small>
                            </div>
                          )
                        ))}
                      </div>
                    ) : (
                      <div className="course-empty-section">
                        {section.id === 'assignments' ? (
                          <button className="btn btn-outline" onClick={() => navigate(`/courses/${courseId}/assignments`)}>
                            {isVi ? 'Xem bài tập và hạn nộp' : 'View assignments and deadlines'}
                          </button>
                        ) : section.id === 'announcements' ? (
                          <button className="btn btn-outline" onClick={() => navigate(`/courses/${courseId}/announcements`)}>
                            {isVi ? 'Xem thông báo môn học' : 'View course announcements'}
                          </button>
                        ) : (
                          isVi ? 'Chưa có nội dung trong mục này.' : 'There is no content in this section yet.'
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'grades' && (
          <div className="course-grades-card">
            <div className="course-grades-heading"><ChevronDown size={15} /><strong>{courseName}</strong></div>
            {gradesError && <p className="form-error" role="alert">{gradesError.message}</p>}
            {gradesLoading && <p className="muted">{isVi ? 'Đang tải điểm...' : 'Loading grades...'}</p>}
            <div className="course-grades-table-wrap">
              <table className="course-grades-table">
                <thead>
                  <tr>
                    <th>{isVi ? 'Mục điểm' : 'Grade item'}</th>
                    <th>{isVi ? 'Trọng số' : 'Weight'}</th>
                    <th>{isVi ? 'Điểm' : 'Score'}</th>
                    <th>{isVi ? 'Thang điểm' : 'Scale'}</th>
                    <th>{isVi ? 'Phần trăm' : 'Percentage'}</th>
                    <th>{isVi ? 'Phản hồi' : 'Feedback'}</th>
                    <th>{isVi ? 'Đóng góp' : 'Contribution'}</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((item) => {
                    const percent = item.score === null ? null : item.score / item.maxScore * 100;
                    const contribution = percent !== null && item.weight !== null ? percent * item.weight : null;
                    return (
                      <tr key={item.id}>
                        <td><span className="grade-item-icon">{item.category === 'manual' ? <Edit3 size={14} /> : <Users size={14} />}</span>
                          <span><small>{item.category === 'manual' ? (isVi ? 'Mục thủ công' : 'Manual item') : (isVi ? 'Điểm danh' : 'Attendance')}</small>
                            <strong>{isVi ? item.titleVi : item.titleEn}</strong></span></td>
                        <td>{item.weight === null ? '—' : `${(item.weight * 100).toLocaleString(isVi ? 'vi-VN' : 'en-US')}%`}</td>
                        <td>{item.score === null ? '—' : item.score.toLocaleString(isVi ? 'vi-VN' : 'en-US')}</td>
                        <td>0–{item.maxScore}</td>
                        <td>{percent === null ? '—' : `${percent.toLocaleString(isVi ? 'vi-VN' : 'en-US')}%`}</td>
                        <td>{item.feedback ?? '—'}</td>
                        <td>{contribution === null ? '—' : `${contribution.toLocaleString(isVi ? 'vi-VN' : 'en-US')}%`}</td>
                      </tr>
                    );
                  })}
                  <tr className="course-grade-total">
                    <td><Sigma size={15} /> {isVi ? 'Tổng đóng góp đã có điểm' : 'Graded contribution'}</td>
                    <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>{totalContribution.toLocaleString(isVi ? 'vi-VN' : 'en-US')}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'personalized' && (
          <div className="course-personalized-empty">
            <Users size={28} />
            <p>{isVi ? 'Lộ trình học tập cá nhân hóa của bạn sẽ được hiển thị tại đây.' : 'Your personalized learning path will be displayed here.'}</p>
            <button className="btn btn-primary" onClick={() => navigate(`/courses/${courseId}/graph`)}>
              {isVi ? 'Mở bản đồ kiến thức' : 'Open knowledge map'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

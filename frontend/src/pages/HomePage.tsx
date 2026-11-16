import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  HelpCircle,
  ExternalLink,
  BookOpen,
  Calendar,
  Clock,
  Bell,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AppHeader } from "../features/layout/AppHeader";
import { useAuth } from "../features/auth/AuthContext";
import { useLanguage } from "../features/i18n/LanguageContext";
import { api } from "../api/client";
import { useAsync } from "../features/common/useAsync";

export const HomePage: React.FC = () => {
  const { language, t } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const isVi = language === "vi";
  const coursesPath = isTeacher ? "/teacher/courses" : "/courses";
  const { data, error } = useAsync(() => api.getHomeSlides(), []);
  const { data: studentCourses } = useAsync(
    () => (isTeacher ? Promise.resolve([]) : api.getStudentCourses()),
    [isTeacher],
  );
  const { data: teacherCourses } = useAsync(
    () => (isTeacher ? api.getTeacherCourses() : Promise.resolve([])),
    [isTeacher],
  );
  const { data: dashboardData } = useAsync(() => api.getDashboard(), []);
  const { data: homeAnnouncements } = useAsync(() => api.getHomeAnnouncements(), []);
  const slides = data ?? [];
  const coursesList = isTeacher ? (teacherCourses ?? []) : (studentCourses ?? []);
  const upcomingActivities = (dashboardData?.activities ?? []).slice(0, 4);
  const weekEvents = (dashboardData?.calendarEvents ?? []).slice(0, 4);
  const announcements = homeAnnouncements ?? [];
  const avgProgress = isTeacher
    ? (teacherCourses?.length
      ? Math.round(
          teacherCourses.reduce(
            (sum, c) => sum + (c.totalNodes ? (c.nodesWithContent / c.totalNodes) * 100 : 0),
            0,
          ) / teacherCourses.length,
        )
      : 0)
    : (studentCourses?.length
      ? Math.round(studentCourses.reduce((sum, c) => sum + c.progress, 0) / studentCourses.length)
      : 0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % Math.max(slides.length, 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="page home-page">
      <AppHeader />

      {/* Hero Slider Banner */}
      <section className="home-slider">
        {error && <p className="form-error" role="alert">{error.message}</p>}
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`home-slide ${index === currentSlide ? "active" : ""}`}
          >
            <img
              src={slide.imageUrl}
              alt={language === "vi" ? slide.titleVi : slide.titleEn}
              className="home-slide-image"
            />
            <div className="home-slide-overlay" />
            <div className="home-slide-content-wrap">
              <div className="home-slide-card">
                <h2>{language === "en" ? slide.titleEn : slide.titleVi}</h2>
                <p>{language === "en" ? slide.subtitleEn : slide.subtitleVi}</p>
                <Link to={coursesPath} className="home-slide-link">
                  <span>{language === "en" ? slide.linkEn : slide.linkVi}</span>
                  <ExternalLink size={14} />
                </Link>
              </div>
            </div>
          </div>
        ))}

        {slides.length > 1 && (
          <button
            onClick={handlePrevSlide}
            className="home-slider-arrow home-slider-prev"
            aria-label={language === "vi" ? "Slide trước" : "Previous slide"}
          >
            <ChevronLeft size={18} />
          </button>
        )}
        {slides.length > 1 && (
          <button
            onClick={handleNextSlide}
            className="home-slider-arrow home-slider-next"
            aria-label={language === "vi" ? "Slide tiếp theo" : "Next slide"}
          >
            <ChevronRight size={18} />
          </button>
        )}

        {slides.length > 1 && (
          <div className="home-slider-dots">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Chuyển đến slide ${idx + 1}`}
                className={idx === currentSlide ? "active" : ""}
              />
            ))}
          </div>
        )}
      </section>

      {/* Nội dung mở rộng Dashboard / Tiện ích */}
      <main className="container home-content">
        <div className="assignments-heading" style={{ marginBottom: 16 }}>
          <div>
            <span className="profile-kicker">
              {isVi
                ? `Xin chào, ${user?.name ?? "Học viên"}`
                : `Welcome, ${user?.name ?? "Learner"}`}
            </span>
            <h1 className="page-title" style={{ margin: 0 }}>{t("home")}</h1>
          </div>
          <Link to={coursesPath} className="btn btn-primary sm">
            {isVi ? "Mở danh sách khóa học" : "Open courses"}
          </Link>
        </div>

        {/* Thống kê nhanh (tương tự bkelgialap Home) */}
        <section className="attendance-summary" style={{ marginBottom: 20 }}>
          <div>
            <span><BookOpen size={14} /> {isVi ? "Khóa học" : "Courses"}</span>
            <strong>{coursesList.length}</strong>
          </div>
          <div>
            <span><Clock size={14} /> {isVi ? "Hoạt động sắp tới" : "Upcoming tasks"}</span>
            <strong>{dashboardData?.activities.length ?? 0}</strong>
          </div>
          <div>
            <span><TrendingUp size={14} /> {isVi ? "Tiến độ trung bình" : "Average progress"}</span>
            <strong>{avgProgress}%</strong>
          </div>
          <div>
            <span><Bell size={14} /> {isVi ? "Thông báo mới" : "Announcements"}</span>
            <strong>{announcements.length}</strong>
          </div>
        </section>

        <div className="home-dashboard-grid">
          {/* Box 1: Khóa học gần đây */}
          <div className="home-dashboard-card">
            <div className="home-card-heading">
              <BookOpen size={17} />
              <h3>{t("recentCourses")}</h3>
            </div>
            {coursesList.length === 0 ? (
              <p>{t("recentCoursesEmpty")}</p>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {coursesList.slice(0, 3).map((course) => (
                  <Link
                    key={course.id}
                    to={isTeacher ? `/teacher/courses/${course.id}/graph` : `/courses/${course.id}/graph`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--surface-muted, #f8fafc)",
                      textDecoration: "none",
                      color: "inherit",
                      fontSize: 13,
                    }}
                  >
                    <span>
                      <strong>{course.code}</strong> · {course.title}
                    </span>
                    <span className="muted-s">
                      {"progress" in course ? `${course.progress}%` : `${course.students} SV`}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Box 2: Deadline & Hoạt động */}
          <div className="home-dashboard-card">
            <div className="home-card-heading">
              <Clock size={17} />
              <h3>{t("upcoming")}</h3>
            </div>
            {upcomingActivities.length === 0 ? (
              <p>{t("upcomingEmpty")}</p>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {upcomingActivities.map((act) => (
                  <Link
                    key={act.id}
                    to={
                      isTeacher
                        ? `/teacher/courses/${act.courseId}/assignments`
                        : `/courses/${act.courseId}/assignments`
                    }
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--surface-muted, #f8fafc)",
                      textDecoration: "none",
                      color: "inherit",
                      fontSize: 13,
                    }}
                  >
                    <span>
                      <strong>{act.courseCode}</strong> · {act.title}
                    </span>
                    <span className="muted-s">
                      {new Date(act.dueAt).toLocaleDateString(isVi ? "vi-VN" : "en-US")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Box 3: Sự kiện học vụ */}
          <div className="home-dashboard-card">
            <div className="home-card-heading">
              <Calendar size={17} />
              <h3>{t("thisWeek")}</h3>
            </div>
            {weekEvents.length === 0 ? (
              <p>{t("thisWeekText")}</p>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {weekEvents.map((evt) => (
                  <Link
                    key={evt.id}
                    to="/dashboard"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--surface-muted, #f8fafc)",
                      textDecoration: "none",
                      color: "inherit",
                      fontSize: 13,
                    }}
                  >
                    <span>
                      <strong>{evt.courseCode}</strong> · {evt.title}
                    </span>
                    <span className="muted-s">{evt.date}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Thông báo mới nhất từ Nhà Trường & Giảng viên */}
        <section className="dashboard-section" style={{ marginTop: 20 }}>
          <div className="dashboard-section-header">
            <h2>
              <Bell size={17} />
              {isVi ? "Thông báo mới nhất từ Nhà Trường & Học phần" : "Latest School & Course Announcements"}
            </h2>
          </div>
          {announcements.length === 0 ? (
            <p className="muted">{isVi ? "Chưa có thông báo mới." : "No recent announcements."}</p>
          ) : (
            <div className="announcement-list" style={{ marginTop: 12 }}>
              {announcements.map((item) => (
                <article className="announcement-card" key={item.id}>
                  <div className="announcement-card-heading">
                    <h2>{item.title}</h2>
                    <span className="assignment-status published">
                      {item.isGlobal ? (isVi ? "Toàn trường" : "Global") : item.courseName}
                    </span>
                  </div>
                  <p>{item.body}</p>
                  <div className="announcement-card-footer">
                    <span className="muted-s">
                      {item.authorName} ·{" "}
                      {new Date(item.publishedAt ?? item.createdAt).toLocaleDateString(
                        isVi ? "vi-VN" : "en-US",
                      )}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Nút chức năng nổi bên phải */}
      <div className="home-floating-actions">
        <button
          onClick={scrollToTop}
          className="home-floating-button"
          title={t("backToTop")}
          aria-label={t("backToTop")}
        >
          <ChevronUp size={18} />
        </button>
        <button
          className="home-floating-button"
          title="Trợ giúp"
          aria-label="Trợ giúp"
        >
          <HelpCircle size={18} />
        </button>
      </div>
    </div>
  );
};

export default HomePage;

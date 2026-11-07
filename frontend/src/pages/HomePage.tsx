import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  HelpCircle,
  ExternalLink,
  BookOpen,
  Calendar,
  Clock
} from "lucide-react";
import { Link } from "react-router-dom";
import { AppHeader } from "../features/layout/AppHeader";
import { useAuth } from "../features/auth/AuthContext";
import { useLanguage } from "../features/i18n/LanguageContext";

interface SlideItem {
  id: number;
  title: string;
  subtitle: string;
  linkText: string;
  imageUrl: string;
}

const SLIDES: SlideItem[] = [
  {
    id: 1,
    title: "Hướng dẫn sử dụng hệ thống",
    subtitle: "Dành cho Giảng viên & Sinh viên (User Guide)",
    linkText: "Xem chi tiết",
    imageUrl:
      "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=1600&auto=format&fit=crop"
  },
  {
    id: 2,
    title: "Thông tin Hoạt động Sinh viên",
    subtitle: "Student Affairs & Ngoại khóa 2026",
    linkText: "Khám phá ngay",
    imageUrl:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop"
  },
  {
    id: 3,
    title: "Thông báo Học vụ & Đăng ký môn",
    subtitle: "Kế hoạch đào tạo và thời khóa biểu học kỳ mới",
    linkText: "Xem lịch trình",
    imageUrl:
      "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?q=80&w=1600&auto=format&fit=crop"
  }
];

export const HomePage: React.FC = () => {
  const { language, t } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const { user } = useAuth();
  const coursesPath = user?.role === "teacher" ? "/teacher/courses" : "/courses";

  // Tự động chuyển slide sau mỗi 6 giây
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? SLIDES.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="page home-page">
      <AppHeader />

      {/* 2. Hero Slider Banner */}
      <section className="home-slider">
        {SLIDES.map((slide, index) => (
          <div
            key={slide.id}
            className={`home-slide ${index === currentSlide ? "active" : ""}`}
          >
            {/* Background image */}
            <img
              src={slide.imageUrl}
              alt={slide.title}
              className="home-slide-image"
            />
            {/* Lớp phủ gradient nhẹ */}
            <div className="home-slide-overlay" />

            {/* Banner Content Card (Glassmorphism) */}
            <div className="home-slide-content-wrap">
              <div className="home-slide-card">
                <h2>{language === "en" ? [
                  "System user guide",
                  "Student Activities",
                  "Academic Notices & Course Registration",
                ][slide.id - 1] : slide.title}</h2>
                <p>{language === "en" ? [
                  "For lecturers and students (User Guide)",
                  "Student Affairs & Extracurricular activities 2026",
                  "Academic plan and new semester timetable",
                ][slide.id - 1] : slide.subtitle}</p>
                <Link to={coursesPath} className="home-slide-link">
                  <span>{language === "en" ? ["View details", "Explore now", "View schedule"][slide.id - 1] : slide.linkText}</span>
                  <ExternalLink size={14} />
                </Link>
              </div>
            </div>
          </div>
        ))}

        {/* Nút điều hướng Carousel */}
        <button
          onClick={handlePrevSlide}
          className="home-slider-arrow home-slider-prev"
          aria-label="Previous Slide"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={handleNextSlide}
          className="home-slider-arrow home-slider-next"
          aria-label="Next Slide"
        >
          <ChevronRight size={18} />
        </button>

        {/* Slide Indicator Dots */}
        <div className="home-slider-dots">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Chuyển đến slide ${idx + 1}`}
              className={idx === currentSlide ? "active" : ""}
            />
          ))}
        </div>
      </section>

      {/* 3. Nội dung mở rộng Dashboard / Tiện ích */}
      <main className="container home-content">
        <h1 className="page-title">{t("home")}</h1>
        <div className="home-dashboard-grid">
          {/* Box 1: Khóa học gần đây */}
          <div className="home-dashboard-card">
            <div className="home-card-heading">
              <BookOpen size={17} />
              <h3>{t("recentCourses")}</h3>
            </div>
            <p>{t("recentCoursesEmpty")}</p>
          </div>

          {/* Box 2: Deadline & Hoạt động */}
          <div className="home-dashboard-card">
            <div className="home-card-heading">
              <Clock size={17} />
              <h3>{t("upcoming")}</h3>
            </div>
            <p>{t("upcomingEmpty")}</p>
          </div>

          {/* Box 3: Sự kiện học vụ */}
          <div className="home-dashboard-card">
            <div className="home-card-heading">
              <Calendar size={17} />
              <h3>{t("thisWeek")}</h3>
            </div>
            <p>{t("thisWeekText")}</p>
          </div>
        </div>
      </main>

      {/* 4. Nút chức năng nổi bên phải (Back to top, Trợ giúp) */}
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
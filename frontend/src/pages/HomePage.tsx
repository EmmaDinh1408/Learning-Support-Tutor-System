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
import { api } from "../api/client";
import { useAsync } from "../features/common/useAsync";

export const HomePage: React.FC = () => {
  const { language, t } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const { user } = useAuth();
  const coursesPath = user?.role === "teacher" ? "/teacher/courses" : "/courses";
  const { data, error } = useAsync(() => api.getHomeSlides(), []);
  const slides = data ?? [];

  // Tự động chuyển slide sau mỗi 6 giây
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

      {/* 2. Hero Slider Banner */}
      <section className="home-slider">
        {error && <p className="form-error" role="alert">{error.message}</p>}
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`home-slide ${index === currentSlide ? "active" : ""}`}
          >
            {/* Background image */}
            <img
              src={slide.imageUrl}
              alt={language === 'vi' ? slide.titleVi : slide.titleEn}
              className="home-slide-image"
            />
            {/* Lớp phủ gradient nhẹ */}
            <div className="home-slide-overlay" />

            {/* Banner Content Card (Glassmorphism) */}
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

        {/* Nút điều hướng Carousel */}
        {slides.length > 1 && <button
          onClick={handlePrevSlide}
          className="home-slider-arrow home-slider-prev"
          aria-label={language === "vi" ? "Slide trước" : "Previous slide"}
        >
          <ChevronLeft size={18} />
        </button>}
        {slides.length > 1 && <button
          onClick={handleNextSlide}
          className="home-slider-arrow home-slider-next"
          aria-label={language === "vi" ? "Slide tiếp theo" : "Next slide"}
        >
          <ChevronRight size={18} />
        </button>}

        {/* Slide Indicator Dots */}
        {slides.length > 1 && <div className="home-slider-dots">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Chuyển đến slide ${idx + 1}`}
              className={idx === currentSlide ? "active" : ""}
            />
          ))}
        </div>}
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
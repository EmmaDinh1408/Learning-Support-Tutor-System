import React, { useState } from "react";
import {
  ChevronDown,
  Search,
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock
} from "lucide-react";
import { AppHeader } from "../features/layout/AppHeader";
import { useLanguage } from "../features/i18n/LanguageContext";

// Định nghĩa kiểu dữ liệu sự kiện / deadline
interface TimelineActivity {
  id: string;
  time: string;
  dateStr: string;
  title: string;
  courseCode: string;
  instructor: string;
  type: "survey" | "assignment" | "quiz";
}

interface CalendarDayEvent {
  id: string;
  title: string;
  type: "warning" | "info" | "success";
}

const SAMPLE_ACTIVITIES: TimelineActivity[] = [
  {
    id: "act-1",
    time: "23:59",
    dateStr: "Thứ Hai, 9 tháng 11, 2026",
    title: "KHẢO SÁT HỌC PHẦN / STUDENT SATISFACTION SURVEY",
    courseCode: "Văn hóa Nhật (SP1043)_ĐẶNG...",
    instructor: "Questionnaire requires action - SP1043 [HK261] [A01,A02]",
    type: "survey"
  },
  {
    id: "act-2",
    time: "23:59",
    dateStr: "Thứ Hai, 9 tháng 11, 2026",
    title: "KHẢO SÁT HỌC PHẦN / STUDENT SATISFACTION SURVEY",
    courseCode: "Mô hình hóa Toán học (CO2011)...",
    instructor: "Questionnaire requires action - CO2011_Phạm An Vinh [HK261] [A01]",
    type: "survey"
  },
  {
    id: "act-3",
    time: "23:59",
    dateStr: "Thứ Hai, 9 tháng 11, 2026",
    title: "KHẢO SÁT HỌC PHẦN / STUDENT SATISFACTION SURVEY",
    courseCode: "Quản lý Dự án cho Kỹ sư (IM102...)",
    instructor: "Questionnaire requires action - IM1022_Lê Phước Lương [HK261] [A02]",
    type: "survey"
  },
  {
    id: "act-4",
    time: "23:59",
    dateStr: "Thứ Hai, 9 tháng 11, 2026",
    title: "KHẢO SÁT HỌC PHẦN / STUDENT SATISFACTION SURVEY",
    courseCode: "Hóa đại cương (CH1003)_LÊ XU...",
    instructor: "Questionnaire requires action - CH1003_Lê Xuân Tiến [HK261] [A02,L02]",
    type: "survey"
  },
  {
    id: "act-5",
    time: "23:59",
    dateStr: "Thứ Hai, 9 tháng 11, 2026",
    title: "KHẢO SÁT HỌC PHẦN / STUDENT SATISFACTION SURVEY",
    courseCode: "Khai phá Dữ liệu (CO3029)_VÕ ...",
    instructor: "Questionnaire requires action - CO3029_Võ Ngọc Tú [HK261] [A01]",
    type: "survey"
  },
  {
    id: "act-6",
    time: "23:59",
    dateStr: "Chủ Nhật, 15 tháng 11, 2026",
    title: "NỘP BÁO CÁO BÀI TẬP LỚN",
    courseCode: "Công nghệ phần mềm (CO3001)",
    instructor: "Assignment submission requires action - HK261",
    type: "assignment"
  }
];

// Dữ liệu mẫu hiển thị trên ô lịch
const CALENDAR_DATA: Record<number, CalendarDayEvent[]> = {
  2: [{ id: "c1", title: "Presentation...", type: "warning" }],
  9: [
    { id: "c2", title: "Khảo sát SP1043", type: "warning" },
    { id: "c3", title: "Khảo sát CO2011", type: "warning" },
    { id: "c4", title: "Khảo sát IM1022", type: "warning" }
  ],
  14: [{ id: "c5", title: "BTL 5. CÂN BẰNG...", type: "warning" }],
  15: [
    { id: "c6", title: "CHƯƠNG 1 (Lý thuyết)", type: "info" },
    { id: "c7", title: "CHƯƠNG 1 (Bài tập)", type: "info" }
  ],
  17: [
    { id: "c8", title: "DISTRIBUTED SYS...", type: "info" },
    { id: "c9", title: "ADVANCED AI...", type: "info" }
  ],
  22: [
    { id: "c10", title: "Bài kiểm tra trắc nghiệm...", type: "warning" },
    { id: "c11", title: "Bài kiểm tra lab...", type: "warning" }
  ],
  28: [{ id: "c12", title: "BTL 7. DUNG LƯỢNG...", type: "warning" }]
};

export const DashboardPage: React.FC = () => {
  const { language, t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDays, setFilterDays] = useState("Next 7 days");
  const [sortBy, setSortBy] = useState("Sort by dates");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(5);

  const daysOfWeek = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  // Giả định tháng 11/2026: ngày 1 rơi vào Chủ Nhật (CN)
  // Cần 6 ô trống phía trước (từ T2 -> T7)
  const emptyDaysBefore = 6;
  const totalDaysInMonth = 30;

  return (
    <div className="page dashboard-page">
      <AppHeader />

      {/* 2. Toàn bộ vùng cuộn Dashboard */}
      <main className="container dashboard-content">
        <h1 className="page-title">{t("dashboard")}</h1>

        {/* --- KHỐI 1: MỐC THỜI GIAN (TIMELINE) --- */}
        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2>
              <Clock size={17} />
              {t("timeline")}
            </h2>
          </div>

          {/* Thanh công cụ lọc & tìm kiếm */}
          <div className="dashboard-toolbar">
            <div className="dashboard-selects">
              <div className="dashboard-select-wrap">
                <select
                  value={filterDays}
                  onChange={(e) => setFilterDays(e.target.value)}
                  className="dashboard-select"
                >
                  <option>{language === "en" ? "Next 7 days" : "7 ngày tới"}</option>
                  <option>{language === "en" ? "Next 14 days" : "14 ngày tới"}</option>
                  <option>{language === "en" ? "Next 30 days" : "30 ngày tới"}</option>
                  <option>{language === "en" ? "All" : "Tất cả"}</option>
                </select>
                <ChevronDown size={13} />
              </div>

              <div className="dashboard-select-wrap">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="dashboard-select"
                >
                  <option>{language === "en" ? "Sort by dates" : "Sắp xếp theo ngày"}</option>
                  <option>{language === "en" ? "Sort by courses" : "Sắp xếp theo khoá học"}</option>
                </select>
                <ChevronDown size={13} />
              </div>
            </div>

            <div className="dashboard-search">
              <Search size={14} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("searchActivity")}
                className="dashboard-input"
              />
            </div>
          </div>

          {/* Vùng danh sách sự kiện - có thể cuộn độc lập nếu danh sách dài */}
          <div className="dashboard-activities">
            <div className="dashboard-activity-date">
              {t("monday")}
            </div>

            {SAMPLE_ACTIVITIES.slice(0, visibleCount).map((item) => (
              <div
                key={item.id}
                className="dashboard-activity"
              >
                <div className="dashboard-activity-main">
                  <div className="dashboard-activity-time">{item.time}</div>
                  <div className="dashboard-activity-icon">
                    <ClipboardList size={15} />
                  </div>
                  <div className="dashboard-activity-copy">
                    <h4>
                      {item.title} <span>{item.courseCode}</span>
                    </h4>
                    <p>{item.instructor}</p>
                  </div>
                </div>

                <button className="dashboard-view-button">
                  {t("view")}
                </button>
              </div>
            ))}
          </div>

          {visibleCount < SAMPLE_ACTIVITIES.length && (
            <div className="dashboard-show-more">
              <button
                onClick={() => setVisibleCount((prev) => prev + 5)}
                className="btn btn-primary"
              >
                {t("showMore")}
              </button>
            </div>
          )}
        </section>

        {/* --- KHỐI 2: LỊCH THÁNG (CALENDAR) --- */}
        <section className="dashboard-section">
          {/* Header của Lịch */}
          <div className="dashboard-section-header dashboard-calendar-header">
            <h2>
              <CalendarIcon size={17} />
              {t("calendar")}
            </h2>

            <div className="dashboard-calendar-actions">
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="dashboard-select dashboard-course-select"
              >
                <option value="all">Tất cả các khoá học</option>
                <option value="CO2011">Mô hình hóa Toán học</option>
                <option value="SP1043">Văn hóa Nhật</option>
                <option value="CO3029">Khai phá Dữ liệu</option>
              </select>

              <button className="btn btn-primary">
                <Plus size={13} />
                <span>{t("newEvent")}</span>
              </button>
            </div>
          </div>

          {/* Thanh chuyển tháng */}
          <div className="dashboard-calendar-nav">
            <button>
              <ChevronLeft size={14} /> Tháng 10
            </button>
            <span>Tháng 11 2026</span>
            <button>
              Tháng 12 <ChevronRight size={14} />
            </button>
          </div>

          {/* Bảng Grid Lịch (Calendar Grid) */}
          <div className="dashboard-calendar">
            {/* Hàng tên thứ */}
            <div className="dashboard-calendar-weekdays">
              {daysOfWeek.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Các ô ngày trong tháng */}
            <div className="dashboard-calendar-grid">
              {/* Render các ô trống trước ngày 1 */}
              {Array.from({ length: emptyDaysBefore }).map((_, i) => (
                <div key={`empty-${i}`} className="dashboard-calendar-empty" />
              ))}

              {/* Render các ngày từ 1 đến 30 */}
              {Array.from({ length: totalDaysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = day === 7; // Ngày 7 tháng 11, 2026
                const dayEvents = CALENDAR_DATA[day] || [];

                return (
                  <div
                    key={`day-${day}`}
                    className={`dashboard-calendar-day ${
                      isToday ? "today" : ""
                    }`}
                  >
                    <div className="dashboard-day-number-wrap">
                      <span
                        className={`dashboard-day-number ${
                          isToday
                            ? "today"
                            : ""
                        }`}
                      >
                        {day}
                      </span>
                    </div>

                    {/* Vùng sự kiện bên trong ngày */}
                    <div className="dashboard-day-events">
                      {dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className={`dashboard-day-event ${
                            ev.type === "warning"
                              ? "warning"
                              : "info"
                          }`}
                          title={ev.title}
                        >
                          <span className="dashboard-event-dot" />
                          <span className="truncate">{ev.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Language = 'vi' | 'en';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'vi',
  setLanguage: () => {},
  t: (key) => key,
});

const STORAGE_KEY = 'g4lms.language';

const translations: Record<Language, Record<string, string>> = {
  vi: {
    home: 'Trang chủ', dashboard: 'Bảng điều khiển', courses: 'Các khoá học của tôi',
    welcome: 'Trang chủ', recentCourses: 'Khóa học truy cập gần đây', recentCoursesEmpty: 'Chưa có môn học nào được mở gần đây.',
    upcoming: 'Hạn nộp sắp tới', upcomingEmpty: 'Không có bài tập hay khảo sát nào cần hoàn thành.',
    thisWeek: 'Lịch tuần này', thisWeekText: 'Xem toàn bộ lịch trình học kỳ trong trang Cá nhân.',
    backToTop: 'Lên đầu trang', help: 'Trợ giúp',
    timeline: 'Mốc thời gian', view: 'Xem', showMore: 'Hiển thị thêm hoạt động',
    calendar: 'Lịch', newEvent: 'Sự kiện mới', allCourses: 'Tất cả các khoá học',
    searchActivity: 'Tìm theo loại hoặc tên hoạt động', monday: 'Thứ Hai, 9 tháng 11, 2026',
    october: 'Tháng 10', november: 'Tháng 11 2026', december: 'Tháng 12',
    search: 'Tìm kiếm', lecturer: 'Giảng viên', completed: 'hoàn thành', gap: 'Lỗ hổng',
    show: 'Hiển thị', ongoing: 'Đang diễn ra', ended: 'Đã kết thúc', all: 'Tất cả',
    teacherAll: 'Tất cả (trừ đã ẩn)', published: 'Đã xuất bản', draft: 'Chưa xuất bản',
    createCourse: 'Tạo khóa học', login: 'Đăng nhập', student: 'Học viên', teacher: 'Giảng viên',
  },
  en: {
    home: 'Home', dashboard: 'Dashboard', courses: 'My courses',
    welcome: 'Home', recentCourses: 'Recently accessed courses', recentCoursesEmpty: 'No courses have been opened recently.',
    upcoming: 'Upcoming deadlines', upcomingEmpty: 'No assignments or surveys need to be completed.',
    thisWeek: 'This week', thisWeekText: 'View the full academic schedule in your personal page.',
    backToTop: 'Back to top', help: 'Help',
    timeline: 'Timeline', view: 'View', showMore: 'Show more activities',
    calendar: 'Calendar', newEvent: 'New event', allCourses: 'All courses',
    searchActivity: 'Search by activity type or name', monday: 'Monday, November 9, 2026',
    october: 'October', november: 'November 2026', december: 'December',
    search: 'Search', lecturer: 'Lecturer', completed: 'complete', gap: 'Gap',
    show: 'Show', ongoing: 'In progress', ended: 'Ended', all: 'All',
    teacherAll: 'All (except hidden)', published: 'Published', draft: 'Unpublished',
    createCourse: 'Create course', login: 'Sign in', student: 'Student', teacher: 'Teacher',
  },
};

function loadLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'en' ? 'en' : 'vi';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(loadLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const setLanguage = (nextLanguage: Language) => setLanguageState(nextLanguage);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: (key) => translations[language][key] ?? key }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);

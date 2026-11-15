import { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Search,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAsync } from '../features/common/useAsync';
import { AppHeader } from '../features/layout/AppHeader';
import { useLanguage } from '../features/i18n/LanguageContext';

const weekDaysVi = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const weekDaysEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DashboardPage() {
  const { language, t } = useLanguage();
  const { data, error, loading } = useAsync(() => api.getDashboard(), []);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState('7');
  const [sort, setSort] = useState('date');
  const [course, setCourse] = useState('all');
  const [visibleCount, setVisibleCount] = useState(5);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const navigate = useNavigate();
  const isVi = language === 'vi';
  const activities = data?.activities ?? [];
  const calendarEvents = data?.calendarEvents ?? [];

  const filteredActivities = useMemo(() => {
    const now = new Date();
    const limit = range === 'all' ? null : new Date(now.getTime() + Number(range) * 86400000);
    const query = search.trim().toLocaleLowerCase();
    return activities
      .filter((item) => (range === 'all' || new Date(item.dueAt) >= now)
        && (!limit || new Date(item.dueAt) <= limit)
        && (course === 'all' || item.courseCode === course)
        && (!query || `${item.title} ${item.courseCode} ${item.description}`.toLocaleLowerCase().includes(query)))
      .sort((a, b) => sort === 'course'
        ? a.courseCode.localeCompare(b.courseCode)
        : new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [activities, course, range, search, sort]);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingDays = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', {
    month: 'long', year: 'numeric',
  }).format(month);
  const currentDate = new Date();
  const monthEvents = calendarEvents.filter((event) => {
    const date = new Date(`${event.date}T00:00:00`);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
      && (course === 'all' || event.courseCode === course);
  });
  const monthTitle = (offset: number) => new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', {
    month: 'short',
  }).format(new Date(month.getFullYear(), month.getMonth() + offset, 1));

  return (
    <div className="page dashboard-page">
      <AppHeader />
      <main className="container dashboard-content">
        <h1 className="page-title">{t('dashboard')}</h1>

        <section className="dashboard-section">
          <div className="dashboard-section-header">
            <h2><Clock size={17} />{t('timeline')}</h2>
          </div>
          <div className="dashboard-toolbar">
            <div className="dashboard-selects">
              <div className="dashboard-select-wrap">
                <select value={range} onChange={(event) => setRange(event.target.value)} className="dashboard-select">
                  <option value="7">{isVi ? '7 ngày tới' : 'Next 7 days'}</option>
                  <option value="14">{isVi ? '14 ngày tới' : 'Next 14 days'}</option>
                  <option value="30">{isVi ? '30 ngày tới' : 'Next 30 days'}</option>
                  <option value="all">{isVi ? 'Tất cả' : 'All dates'}</option>
                </select>
                <ChevronDown size={13} />
              </div>
              <div className="dashboard-select-wrap">
                <select value={sort} onChange={(event) => setSort(event.target.value)} className="dashboard-select">
                  <option value="date">{isVi ? 'Sắp xếp theo ngày' : 'Sort by date'}</option>
                  <option value="course">{isVi ? 'Sắp xếp theo khóa học' : 'Sort by course'}</option>
                </select>
                <ChevronDown size={13} />
              </div>
            </div>
            <div className="dashboard-search">
              <Search size={14} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchActivity')} className="dashboard-input" />
            </div>
          </div>

          <div className="dashboard-activities">
            {error && <p className="form-error" role="alert">{error.message}</p>}
            {loading && <p className="muted">{isVi ? 'Đang tải hoạt động...' : 'Loading activities...'}</p>}
            {filteredActivities.slice(0, visibleCount).map((item) => (
              <div className="dashboard-activity" key={item.id}>
                <div className="dashboard-activity-main">
                  <div className="dashboard-activity-time">
                    {new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.dueAt))}
                  </div>
                  <div className="dashboard-activity-icon"><ClipboardList size={15} /></div>
                  <div className="dashboard-activity-copy">
                    <h4>{item.title} <span>{item.courseCode}</span></h4>
                    <p>{new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', { dateStyle: 'full' }).format(new Date(item.dueAt))} · {item.description}</p>
                  </div>
                </div>
                {item.type === 'assignment' || (item.type === 'quiz' && item.targetId) ? (
                  <button className="dashboard-view-button" onClick={() => navigate(item.type === 'quiz'
                    ? `/courses/${item.courseId}/quizzes/${item.targetId}`
                    : `/courses/${item.courseId}/assignments`)}>
                    {t('view')}
                  </button>
                ) : null}
              </div>
            ))}
            {!filteredActivities.length && (
              <p className="course-empty-section">{isVi ? 'Không có hoạt động phù hợp.' : 'No matching activities.'}</p>
            )}
          </div>
          {visibleCount < filteredActivities.length && (
            <div className="dashboard-show-more">
              <button onClick={() => setVisibleCount((count) => count + 5)} className="btn btn-primary">{t('showMore')}</button>
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-header dashboard-calendar-header">
            <h2><CalendarIcon size={17} />{t('calendar')}</h2>
            <select value={course} onChange={(event) => setCourse(event.target.value)} className="dashboard-select dashboard-course-select">
              <option value="all">{t('allCourses')}</option>
              {[...new Set(calendarEvents.map((event) => event.courseCode))].sort().map((code) => (
                <option value={code} key={code}>{code}</option>
              ))}
            </select>
          </div>
          <div className="dashboard-calendar-nav">
            <button onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}>
              <ChevronLeft size={14} /> {monthTitle(-1)}
            </button>
            <span>{monthLabel}</span>
            <button onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}>
              {monthTitle(1)} <ChevronRight size={14} />
            </button>
          </div>
          <div className="dashboard-calendar">
            <div className="dashboard-calendar-weekdays">
              {(isVi ? weekDaysVi : weekDaysEn).map((day) => <div key={day}>{day}</div>)}
            </div>
            <div className="dashboard-calendar-grid">
              {Array.from({ length: leadingDays }, (_, index) => <div key={`empty-${index}`} className="dashboard-calendar-empty" />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const events = monthEvents.filter((event) => event.date === key);
                const today = day === currentDate.getDate()
                  && month.getMonth() === currentDate.getMonth()
                  && month.getFullYear() === currentDate.getFullYear();
                return (
                  <div key={key} className={`dashboard-calendar-day ${today ? 'today' : ''}`}>
                    <div className="dashboard-day-number-wrap"><span className={`dashboard-day-number ${today ? 'today' : ''}`}>{day}</span></div>
                    <div className="dashboard-day-events">
                      {events.map((event) => (
                        <div key={event.id} className={`dashboard-day-event ${event.type}`} title={`${event.courseCode}: ${event.title}`}>
                          <span className="dashboard-event-dot" /><span className="truncate">{event.title}</span>
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
}

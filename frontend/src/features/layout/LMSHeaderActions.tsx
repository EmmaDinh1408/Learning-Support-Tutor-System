import {
  Bell,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Globe,
  GraduationCap,
  LogOut,
  MessageSquare,
  User,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { api } from '../../api/client';
import { useAsync } from '../common/useAsync';
import type { NotificationRecord } from '../../types';

type OpenMenu = 'notifications' | 'messages' | 'user' | null;

interface NotificationItemProps {
  title: string;
  description: string;
  time: string;
}

function NotificationItem({ title, description, time }: NotificationItemProps) {
  return (
    <div className="header-notification-item">
      <div className="header-notification-title">{title}</div>
      <p>{description}</p>
      <div className="header-notification-time"><Clock size={11} /> {time}</div>
    </div>
  );
}

function MenuLink({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="header-user-menu-item" onClick={onClick}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export default function LMSHeaderActions() {
  const { user, setUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const nav = useNavigate();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [notificationItems, setNotificationItems] = useState<NotificationRecord[]>([]);
  const [notificationError, setNotificationError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: notificationData, error: notificationsError } = useAsync(() => api.getNotifications(), []);
  const { data: messageData, error: messagesError } = useAsync(() => api.getMessages(), []);
  const { data: courses, error: coursesError } = useAsync(
    async () => user?.role === 'teacher' ? await api.getTeacherCourses() : await api.getStudentCourses(),
    [user?.role],
  );
  const notifications = notificationItems;
  const messages = messageData ?? [];
  const hasUnreadNotifications = notifications.some((item) => !item.read);

  useEffect(() => {
    if (notificationData) setNotificationItems(notificationData);
  }, [notificationData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menu: Exclude<OpenMenu, null>) => {
    setOpenMenu((current) => current === menu ? null : menu);
  };

  const logout = () => {
    setUser(null);
    setOpenMenu(null);
    nav('/login');
  };

  const markNotificationsRead = async () => {
    setNotificationError('');
    try {
      await api.markNotificationsRead();
      setNotificationItems((current) => current.map((item) => ({ ...item, read: true })));
    } catch (reason) {
      setNotificationError(reason instanceof Error ? reason.message : 'Không thể cập nhật thông báo.');
    }
  };

  const openGrades = () => {
    setOpenMenu(null);
    if (user?.role !== 'teacher') {
      nav('/grades');
      return;
    }
    const firstCourse = courses?.[0];
    if (!firstCourse) {
      nav(user?.role === 'teacher' ? '/teacher/courses' : '/courses');
      return;
    }
    nav(user?.role === 'teacher'
      ? `/teacher/courses/${firstCourse.id}/grades`
      : `/courses/${firstCourse.id}/grades`);
  };

  return (
    <div ref={containerRef} className="header-actions">
      <div className="header-action-menu">
        <button
          type="button"
          className={`icon-btn header-action-button ${openMenu === 'notifications' ? 'active' : ''}`}
          onClick={() => toggleMenu('notifications')}
          aria-label={language === 'vi' ? 'Thông báo' : 'Notifications'}
          aria-expanded={openMenu === 'notifications'}
        >
          <Bell size={15} />
          {hasUnreadNotifications && <span className="badge-dot" />}
        </button>

        {openMenu === 'notifications' && (
          <div className="header-popover header-notifications">
            <div className="header-popover-header">
              <span>{language === 'vi' ? 'Thông báo' : 'Notifications'}</span>
              <button
                type="button"
                onClick={markNotificationsRead}
                className="header-mark-read"
              >
                <Check size={12} /> {language === 'vi' ? 'Đánh dấu đã đọc' : 'Mark as read'}
              </button>
            </div>
            <div className="header-popover-list">
              {notificationError && <p className="form-error" role="alert">{notificationError}</p>}
              {notificationsError && <p className="form-error" role="alert">{notificationsError.message}</p>}
              {notifications.map((item) => (
                <NotificationItem key={item.id} title={item.title} description={item.description} time={item.time} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="header-action-menu">
        <button
          type="button"
          className={`icon-btn header-action-button ${openMenu === 'messages' ? 'active' : ''}`}
          onClick={() => toggleMenu('messages')}
          aria-label={language === 'vi' ? 'Tin nhắn' : 'Messages'}
          aria-expanded={openMenu === 'messages'}
        >
          <MessageSquare size={15} />
          {messages.some((message) => message.unread) && <span className="badge-dot" />}
        </button>

        {openMenu === 'messages' && (
          <div className="header-popover header-messages">
            <div className="header-popover-header">
              <span>{language === 'vi' ? 'Tin nhắn trao đổi' : 'Messages'}</span>
              <span className="header-new-count">{messages.filter((message) => message.unread).length} {language === 'vi' ? 'mới' : 'new'}</span>
            </div>
            <div className="header-message-list">
              {messagesError && <p className="form-error" role="alert">{messagesError.message}</p>}
              {messages.map((message, index) => (
                <button type="button" className="header-message-item" key={message.id}>
                  <div className={`header-message-avatar ${index % 2 ? 'green' : ''}`}>{message.initials}</div>
                  <div>
                    <div className="header-message-meta">
                      <strong>{message.sender}</strong>
                      <span>{message.time}</span>
                    </div>
                    <p>{message.preview}</p>
                  </div>
                </button>
              ))}
            </div>
            <button type="button" className="header-popover-link" onClick={() => { setOpenMenu(null); nav('/messages'); }}>
              {language === 'vi' ? 'Mở hộp thư' : 'Open inbox'}
            </button>
          </div>
        )}
      </div>

      <div className="header-action-menu header-user-menu">
        <button
          type="button"
          className="avatar-btn header-user-button"
          onClick={() => toggleMenu('user')}
          aria-expanded={openMenu === 'user'}
        >
          {user?.initials ?? 'NA'}
          <ChevronDown size={12} className={openMenu === 'user' ? 'open' : ''} />
        </button>

        {openMenu === 'user' && (
          <div className="header-popover header-user-popover">
            <div className="header-user-summary">
              <strong>{language === 'vi'
                ? (user?.role === 'teacher' ? 'Tài khoản giảng viên' : 'Tài khoản sinh viên')
                : (user?.role === 'teacher' ? 'Teacher account' : 'Student account')}</strong>
              <span>{user?.name}</span>
            </div>
            {coursesError && <p className="form-error" role="alert">{coursesError.message}</p>}
            <MenuLink
              icon={<User size={14} />}
              onClick={() => {
                setOpenMenu(null);
                nav(user?.role === 'teacher' ? '/profile/teacher' : '/profile/student');
              }}
            >
              {language === 'vi' ? 'Hồ sơ' : 'Profile'}
            </MenuLink>
            <MenuLink icon={<GraduationCap size={14} />} onClick={openGrades}>{language === 'vi' ? 'Điểm' : 'Grades'}</MenuLink>
            <MenuLink icon={<Calendar size={14} />} onClick={() => { setOpenMenu(null); nav('/dashboard'); }}>{language === 'vi' ? 'Thời khoá biểu (TKB)' : 'Timetable'}</MenuLink>
            <div className="header-language-section">
              <div className="header-language-label"><Globe size={14} /> {language === 'vi' ? 'Ngôn ngữ' : 'Language'}</div>
              <div className="header-language-options">
                <button type="button" className={language === 'vi' ? 'active' : ''} onClick={() => setLanguage('vi')}>Tiếng Việt</button>
                <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>English</button>
              </div>
            </div>
            <button type="button" className="header-user-menu-item logout" onClick={logout}>
              <LogOut size={14} />
              <span>{language === 'vi' ? 'Thoát' : 'Sign out'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

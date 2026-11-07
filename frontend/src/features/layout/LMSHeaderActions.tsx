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
  const [unreadNotifications, setUnreadNotifications] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

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
          {unreadNotifications && <span className="badge-dot" />}
        </button>

        {openMenu === 'notifications' && (
          <div className="header-popover header-notifications">
            <div className="header-popover-header">
              <span>{language === 'vi' ? 'Thông báo' : 'Notifications'}</span>
              <button
                type="button"
                onClick={() => setUnreadNotifications(false)}
                className="header-mark-read"
              >
                <Check size={12} /> {language === 'vi' ? 'Đánh dấu đã đọc' : 'Mark as read'}
              </button>
            </div>
            <div className="header-popover-list">
              <NotificationItem
                title="Hạn nộp: Khảo sát môn học HK261"
                description="Vui lòng hoàn thành khảo sát môn Mô hình hóa Toán học trước 23:59 hôm nay."
                time="2 giờ trước"
              />
              <NotificationItem
                title="Thông báo cập nhật lịch thi giữa kỳ"
                description="Phòng Đào tạo đã đăng tải lịch thi chính thức cho các lớp học phần."
                time="Hôm qua"
              />
              <NotificationItem
                title="Bài tập lớn: Đã cập nhật đề cương"
                description="Giảng viên môn Quản lý Dự án đã tải lên tài liệu hướng dẫn nhóm."
                time="3 ngày trước"
              />
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
          <span className="badge-dot" />
        </button>

        {openMenu === 'messages' && (
          <div className="header-popover header-messages">
            <div className="header-popover-header">
              <span>{language === 'vi' ? 'Tin nhắn trao đổi' : 'Messages'}</span>
              <span className="header-new-count">{language === 'vi' ? '2 mới' : '2 new'}</span>
            </div>
            <div className="header-message-list">
              <button type="button" className="header-message-item">
                <div className="header-message-avatar">GV</div>
                <div>
                  <div className="header-message-meta">
                    <strong>Thầy Phạm An Vinh</strong>
                    <span>10:45</span>
                  </div>
                  <p>Nhóm em kiểm tra lại câu hỏi số 2 nhé...</p>
                </div>
              </button>
              <button type="button" className="header-message-item">
                <div className="header-message-avatar green">LT</div>
                <div>
                  <div className="header-message-meta">
                    <strong>Lớp trưởng CO3029</strong>
                    <span>Hôm qua</span>
                  </div>
                  <p>Link drive bài nộp chung ở đây nha các bạn.</p>
                </div>
              </button>
            </div>
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
            <MenuLink icon={<User size={14} />}>{language === 'vi' ? 'Hồ sơ' : 'Profile'}</MenuLink>
            <MenuLink icon={<GraduationCap size={14} />}>{language === 'vi' ? 'Điểm' : 'Grades'}</MenuLink>
            <MenuLink icon={<Calendar size={14} />}>{language === 'vi' ? 'Thời khoá biểu (TKB)' : 'Timetable'}</MenuLink>
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

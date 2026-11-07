import { Bell, ChevronDown, GraduationCap, MessageSquare } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

interface Props {
  editMode?: boolean;
  onEditModeChange?: (v: boolean) => void;
  showEditToggle?: boolean;
}

export function AppHeader({ editMode, onEditModeChange, showEditToggle }: Props) {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isTeacher = user?.role === 'teacher';
  const coursesPath = isTeacher ? '/teacher/courses' : '/courses';

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <header className="app-header">
      <Link to={coursesPath} className="brand">
        <GraduationCap size={14} /> <b>G4LMS</b>
      </Link>
      <nav className="main-nav">
        <a>Trang chủ</a>
        <a>Bảng điều khiển</a>
        <NavLink to={coursesPath} className="active">Các khoá học của tôi</NavLink>
      </nav>
      <div className="header-right">
        {showEditToggle && (
          <label className="edit-toggle">
            Chế độ chỉnh sửa
            <input type="checkbox" checked={!!editMode} onChange={(e) => onEditModeChange?.(e.target.checked)} />
          </label>
        )}
        <button className="icon-btn" aria-label="Thông báo"><Bell size={15} /><span className="badge-dot" /></button>
        <button className="icon-btn" aria-label="Tin nhắn"><MessageSquare size={15} /><span className="badge-dot" /></button>
        <div className="avatar-menu" ref={ref}>
          <button className="avatar-btn" onClick={() => setOpen((o) => !o)}>
            {user?.initials ?? 'NA'} <ChevronDown size={12} />
          </button>
          {open && (
            <div className="dropdown">
              <div className="dropdown-name">{user?.name}</div>
              <button onClick={() => { setUser(null); nav('/login'); }}>Đăng xuất</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

import { GraduationCap } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import LMSHeaderActions from './LMSHeaderActions';

interface Props {
  editMode?: boolean;
  onEditModeChange?: (v: boolean) => void;
  showEditToggle?: boolean;
}

export function AppHeader({ editMode, onEditModeChange, showEditToggle }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isTeacher = user?.role === 'teacher';
  const coursesPath = isTeacher ? '/teacher/courses' : '/courses';

  return (
    <header className="app-header">
      <Link to="/home" className="brand">
        <GraduationCap size={14} /> <b>G4LMS</b>
      </Link>
      <nav className="main-nav">
        <NavLink to="/home">{t('home')}</NavLink>
        <NavLink to="/dashboard">{t('dashboard')}</NavLink>
        <NavLink to={coursesPath}>{t('courses')}</NavLink>
      </nav>
      <div className="header-right">
        {showEditToggle && (
          <label className="edit-toggle">
            Chế độ chỉnh sửa
            <input type="checkbox" checked={!!editMode} onChange={(e) => onEditModeChange?.(e.target.checked)} />
          </label>
        )}
        <LMSHeaderActions />
      </div>
    </header>
  );
}

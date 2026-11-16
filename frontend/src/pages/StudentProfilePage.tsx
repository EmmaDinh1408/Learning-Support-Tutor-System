import { AppHeader } from '../features/layout/AppHeader';
import { useAuth } from '../features/auth/AuthContext';
import { useLanguage } from '../features/i18n/LanguageContext';
import { api } from '../api/client';
import { useAsync } from '../features/common/useAsync';
import ProfileSettings from '../features/profile/ProfileSettings';

export default function StudentProfilePage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { data: details, error } = useAsync(() => api.getProfileDetails('student'), []);

  return (
    <div className="page">
      <AppHeader />
      <main className="container profile-container">
        <div className="profile-heading">
          <div>
            <span className="profile-kicker">{language === 'vi' ? 'Tài khoản' : 'Account'}</span>
            <h1>{language === 'vi' ? 'Hồ sơ sinh viên' : 'Student profile'}</h1>
          </div>
          <span className="profile-role">{language === 'vi' ? 'Sinh viên' : 'Student'}</span>
        </div>

        <section className="profile-card">
          {error && <p className="form-error" role="alert">{error.message}</p>}
          <div className="profile-avatar">{user?.initials ?? 'SV'}</div>
          <div className="profile-main-fields">
            <label>
              {language === 'vi' ? 'Họ và tên' : 'Full name'}
              <input value={user?.name ?? ''} readOnly />
            </label>
            <label>
              Email
              <input type="email" value={user?.email ?? ''} readOnly />
            </label>
          </div>
          <dl className="profile-info-grid">
            <div><dt>{language === 'vi' ? 'Vai trò' : 'Role'}</dt><dd>{language === 'vi' ? 'Sinh viên' : 'Student'}</dd></div>
            <div><dt>{language === 'vi' ? 'Mã sinh viên' : 'Student ID'}</dt><dd>{details?.id ?? '—'}</dd></div>
            <div><dt>{language === 'vi' ? details?.labelVi : details?.labelEn}</dt><dd>{language === 'vi' ? details?.fieldVi : details?.fieldEn}</dd></div>
            <div><dt>{language === 'vi' ? 'Khóa học' : 'Class year'}</dt><dd>{details?.extra ?? '—'}</dd></div>
          </dl>
        </section>
        <ProfileSettings />
      </main>
    </div>
  );
}

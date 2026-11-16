import { BookOpen, Eye, EyeOff, GraduationCap, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import { useAsync } from '../features/common/useAsync';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { Role } from '../types';

const PLACEHOLDER: Record<Role, string> = {
  student: 'sinhvien@hcmut.edu.vn',
  teacher: 'giangvien@hcmut.edu.vn',
  admin: 'admin@hcmut.edu.vn',
};

export default function LoginPage() {
  const [role, setRole] = useState<Role>('student');
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const { setUser, authError } = useAuth();
  const { language } = useLanguage();
  const nav = useNavigate();
  const { data, error: statsError } = useAsync(() => api.getLoginHeroStats(), []);
  const stats = data ?? [];
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  const switchRole = (r: Role) => { setRole(r); setIdentity(''); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await api.login(identity || PLACEHOLDER[role], password, role);
      setUser(user);
      nav(user.role === 'admin' ? '/admin' : '/home');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đăng nhập.');
    } finally {
      setBusy(false);
    }
  };

  const requestPasswordReset = async () => {
    setError('');
    setResetMessage('');
    setResetMessage('Vui lòng liên hệ quản trị viên để được cấp mật khẩu tạm thời.');
  };

  const label = role === 'student' ? 'Học viên' : role === 'teacher' ? 'Giảng viên' : 'Quản trị viên';

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="hero-logo"><GraduationCap size={16} /> G4LMS</div>
        <div className="hero-card">
          <h2>Chào mừng đến G4LMS</h2>
          <p>Hệ thống học tập thích ứng dựa trên Knowledge Graph — cá nhân hoá lộ trình học cho từng học viên.</p>
          <div className="hero-stats">
            {stats.map((item) => (
              <div key={item.labelVi}>
                <b>{item.value}</b>
                <span>{language === 'vi' ? item.labelVi : item.labelEn}</span>
              </div>
            ))}
          </div>
          {statsError && <p className="form-error" role="alert">{statsError.message}</p>}
        </div>
      </section>

      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <h1>Đăng nhập</h1>
          <p className="muted">Đăng nhập vào G4LMS – Hệ thống Microlearning AI</p>

          <div className="role-tabs three" role="tablist">
            <button type="button" role="tab" aria-selected={role === 'student'} className={role === 'student' ? 'on' : ''} onClick={() => switchRole('student')}>
              <BookOpen size={12} /> Học viên
            </button>
            <button type="button" role="tab" aria-selected={role === 'teacher'} className={role === 'teacher' ? 'on' : ''} onClick={() => switchRole('teacher')}>
              <Users size={12} /> Giảng viên
            </button>
            <button type="button" role="tab" aria-selected={role === 'admin'} className={role === 'admin' ? 'on' : ''} onClick={() => switchRole('admin')}>
              <ShieldCheck size={12} /> Quản trị
            </button>
          </div>

          <label className="field">
            <span>Tên đăng nhập hoặc email</span>
            <input value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder={PLACEHOLDER[role]} />
          </label>
          <label className="field">
            <span>Mật khẩu</span>
            <div className="pw">
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu" />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label="Hiện/ẩn mật khẩu">
                {show ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </label>
          <a className="forgot" href="#" onClick={(e) => { e.preventDefault(); void requestPasswordReset(); }}>Quên mật khẩu?</a>

          {error && <p className="form-error" role="alert">{error}</p>}
          {resetMessage && <p className="admin-success" role="status">{resetMessage}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>Đăng nhập với tư cách {label}</button>
          <p className="no-account">Chưa có tài khoản? <a href="#" onClick={(e) => e.preventDefault()}>Liên hệ quản trị viên</a></p>

          <div className="login-note">
            {role === 'student' ? <BookOpen size={12} /> : role === 'teacher' ? <Users size={12} /> : <ShieldCheck size={12} />}
            {role === 'student'
              ? 'Đăng nhập với tư cách Học viên để xem bản đồ kiến thức cá nhân.'
              : role === 'teacher'
                ? 'Đăng nhập với tư cách Giảng viên để quản lý khóa học và graph.'
                : 'Đăng nhập với tư cách Quản trị viên để quản lý tài khoản và ghi danh.'}
          </div>
        </form>
      </section>
    </div>
  );
}

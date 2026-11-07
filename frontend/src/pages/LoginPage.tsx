import { BookOpen, Eye, EyeOff, GraduationCap, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';
import type { Role } from '../types';

const PLACEHOLDER: Record<Role, string> = {
  student: 'sinhvien@hcmut.edu.vn',
  teacher: 'giangvien@hcmut.edu.vn',
};

export default function LoginPage() {
  const [role, setRole] = useState<Role>('student');
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const nav = useNavigate();

  const switchRole = (r: Role) => { setRole(r); setIdentity(''); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const user = await api.login(identity || PLACEHOLDER[role], password, role);
    setUser(user);
    nav('/home');
  };

  const label = role === 'student' ? 'Học viên' : 'Giảng viên';

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="hero-logo"><GraduationCap size={16} /> G4LMS</div>
        <div className="hero-card">
          <h2>Chào mừng đến G4LMS</h2>
          <p>Hệ thống học tập thích ứng dựa trên Knowledge Graph — cá nhân hoá lộ trình học cho từng học viên.</p>
          <div className="hero-stats">
            <div><b>12,400+</b><span>Học viên</span></div>
            <div><b>380</b><span>Khoá học</span></div>
            <div><b>98%</b><span>Hoàn thành</span></div>
          </div>
        </div>
      </section>

      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <h1>Đăng nhập</h1>
          <p className="muted">Đăng nhập vào G4LMS – Hệ thống Microlearning AI</p>

          <div className="role-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={role === 'student'} className={role === 'student' ? 'on' : ''} onClick={() => switchRole('student')}>
              <BookOpen size={12} /> Học viên
            </button>
            <button type="button" role="tab" aria-selected={role === 'teacher'} className={role === 'teacher' ? 'on' : ''} onClick={() => switchRole('teacher')}>
              <Users size={12} /> Giảng viên
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
          <a className="forgot" href="#" onClick={(e) => e.preventDefault()}>Quên mật khẩu?</a>

          <button className="btn btn-primary btn-block" disabled={busy}>Đăng nhập với tư cách {label}</button>
          <p className="no-account">Chưa có tài khoản? <a href="#" onClick={(e) => e.preventDefault()}>Liên hệ quản trị viên</a></p>

          <div className="login-note">
            {role === 'student' ? <BookOpen size={12} /> : <Users size={12} />}
            {role === 'student'
              ? 'Đăng nhập với tư cách Học viên để xem bản đồ kiến thức cá nhân.'
              : 'Đăng nhập với tư cách Giảng viên để quản lý khóa học và graph.'}
          </div>
        </form>
      </section>
    </div>
  );
}

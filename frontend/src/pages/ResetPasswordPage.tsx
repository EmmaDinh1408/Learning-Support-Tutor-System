import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../features/auth/AuthContext';

export default function ResetPasswordPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!user) {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Mật khẩu cần ít nhất 8 ký tự, gồm 1 chữ hoa và 1 chữ số.');
      return;
    }
    if (password !== confirmation) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setBusy(true);
    try {
      const session = await api.changePassword({ currentPassword, newPassword: password });
      setUser({ ...session.user, accessToken: session.accessToken });
      navigate(user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/teacher/courses' : '/home', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật mật khẩu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-form-wrap">
      <form className="login-form" onSubmit={submit}>
        <h1>Đổi mật khẩu</h1>
        <p className="muted">Tài khoản cần đổi mật khẩu tạm thời trước khi tiếp tục.</p>
        <label className="field"><span>Mật khẩu hiện tại</span>
          <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </label>
        <label className="field"><span>Mật khẩu mới</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <label className="field"><span>Xác nhận mật khẩu</span>
          <input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}</button>
      </form>
    </main>
  );
}

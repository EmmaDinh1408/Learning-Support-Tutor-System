import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../auth/AuthContext';

export default function ProfileSettings() {
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState(user?.name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void api.getMyProfile().then((profile) => {
      if (!active) return;
      setFullName(profile.fullName);
      setDateOfBirth(profile.dateOfBirth ?? '');
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải hồ sơ.');
    });
    return () => { active = false; };
  }, []);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || fullName.trim().length < 2 || fullName.trim().length > 100) {
      setError('Họ tên phải có từ 2 đến 100 ký tự.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const profile = await api.updateMyProfile({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth || null,
      });
      const name = profile.fullName;
      const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(-2).join('').toUpperCase();
      setUser({ ...user, name, initials });
      setMessage('Đã cập nhật thông tin cá nhân.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật hồ sơ.');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Mật khẩu cần ít nhất 8 ký tự, gồm 1 chữ hoa và 1 chữ số.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const session = await api.changePassword({ currentPassword, newPassword });
      setUser({ ...session.user, accessToken: session.accessToken });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Đã đổi mật khẩu.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đổi mật khẩu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-settings-grid">
      <section className="dashboard-section">
        <h2 className="admin-card-title">Thông tin cá nhân</h2>
        <form className="admin-form" onSubmit={saveProfile}>
          <label className="field"><span>Email (không thể chỉnh sửa)</span><input type="email" value={user?.email ?? ''} readOnly /></label>
          <label className="field"><span>Họ và tên</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={100} required /></label>
          <label className="field"><span>Ngày sinh</span><input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /></label>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu thông tin'}</button>
        </form>
      </section>
      <section className="dashboard-section">
        <h2 className="admin-card-title">Đổi mật khẩu</h2>
        <form className="admin-form" onSubmit={changePassword}>
          <label className="field"><span>Mật khẩu hiện tại</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
          <label className="field"><span>Mật khẩu mới</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
          <label className="field"><span>Xác nhận mật khẩu</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
          <p className="muted">Tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 chữ số.</p>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Đang cập nhật...' : 'Đổi mật khẩu'}</button>
        </form>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="admin-success" role="status">{message}</p>}
    </div>
  );
}

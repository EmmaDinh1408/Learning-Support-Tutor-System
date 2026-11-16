import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import type { AdminUser, Role } from '../types';

const roleLabels: Record<Role, string> = {
  admin: 'Quản trị viên',
  teacher: 'Giảng viên',
  student: 'Sinh viên',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await api.getAdminUsers());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const resetPassword = async () => {
    if (!passwordTarget) return;
    if (temporaryPassword.length < 8 || !/[A-Z]/.test(temporaryPassword) || !/[0-9]/.test(temporaryPassword)) {
      setError('Mật khẩu tạm thời cần ít nhất 8 ký tự, gồm 1 chữ hoa và 1 chữ số.');
      return;
    }
    setBusyId(passwordTarget.id);
    setError('');
    setActionMessage('');
    try {
      await api.resetAdminUserPassword(passwordTarget.id, temporaryPassword);
      setActionMessage(`Đã đặt lại mật khẩu cho ${passwordTarget.email}. Người dùng sẽ phải đổi mật khẩu khi đăng nhập.`);
      setPasswordTarget(null);
      setTemporaryPassword('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đặt lại mật khẩu.');
    } finally {
      setBusyId('');
    }
  };

  const deleteUser = async (user: AdminUser) => {
    if (user.role === 'admin') return;
    if (!window.confirm(`Xóa tài khoản ${user.email}? Thao tác này không thể hoàn tác.`)) return;
    setBusyId(user.id);
    setError('');
    setActionMessage('');
    try {
      await api.deleteAdminUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setActionMessage(`Đã xóa tài khoản ${user.email}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể xóa tài khoản.');
    } finally {
      setBusyId('');
    }
  };

  const filteredUsers = users.filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="page">
      <AppHeader />
      <main className="container admin-container">
        <div className="admin-heading">
          <div>
            <span className="profile-kicker">Quản trị</span>
            <h1 className="page-title">Người dùng</h1>
            <p className="muted">{users.length} tài khoản</p>
          </div>
          <Link className="btn btn-primary" to="/admin">Tạo tài khoản</Link>
        </div>
        <label className="field admin-search">
          <span>Tìm theo tên hoặc email</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập từ khóa..." />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {actionMessage && <p className="admin-success" role="status">{actionMessage}</p>}
        {passwordTarget && (
          <section className="dashboard-section admin-form">
            <h2 className="admin-card-title">Đặt lại mật khẩu · {passwordTarget.email}</h2>
            <label className="field">
              <span>Mật khẩu tạm thời</span>
              <input type="password" autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} />
            </label>
            <p className="muted">Chia sẻ mật khẩu qua kênh an toàn; người dùng sẽ phải đổi mật khẩu khi đăng nhập.</p>
            <div className="admin-row-actions">
              <button className="btn btn-primary sm" type="button" disabled={busyId === passwordTarget.id} onClick={() => void resetPassword()}>Đặt lại</button>
              <button className="btn btn-outline sm" type="button" onClick={() => { setPasswordTarget(null); setTemporaryPassword(''); }}>Hủy</button>
            </div>
          </section>
        )}
        <section className="dashboard-section admin-table-wrap">
          {loading ? <p className="muted">Đang tải người dùng...</p> : filteredUsers.length === 0 ? (
            <p className="muted">Không tìm thấy người dùng.</p>
          ) : (
            <table className="admin-table">
              <thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td><span className={`admin-role ${user.role}`}>{roleLabels[user.role]}</span></td>
                    <td>{new Date(user.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="admin-row-actions">
                      <button className="btn btn-outline sm" type="button" disabled={busyId === user.id} onClick={() => { setPasswordTarget(user); setError(''); setActionMessage(''); }}>
                        Đặt lại mật khẩu
                      </button>
                      <button className="btn btn-danger sm" type="button" disabled={busyId === user.id || user.role === 'admin'} onClick={() => void deleteUser(user)}>
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

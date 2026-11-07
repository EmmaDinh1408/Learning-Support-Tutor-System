import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';
import LoginPage from './pages/LoginPage';
import StudentCoursesPage from './pages/StudentCoursesPage';
import StudentCourseGraphPage from './pages/StudentCourseGraphPage';
import TeacherCoursesPage from './pages/TeacherCoursesPage';
import TeacherCourseGraphPage from './pages/TeacherCourseGraphPage';
import TeacherNodeEditorPage from './pages/TeacherNodeEditorPage';
import type { Role } from './types';
import type { ReactNode } from 'react';

function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'teacher' ? '/teacher/courses' : '/courses'} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/courses" element={<Guard role="student"><StudentCoursesPage /></Guard>} />
      <Route path="/courses/:courseId/graph" element={<Guard role="student"><StudentCourseGraphPage /></Guard>} />
      <Route path="/teacher/courses" element={<Guard role="teacher"><TeacherCoursesPage /></Guard>} />
      <Route path="/teacher/courses/:courseId/graph" element={<Guard role="teacher"><TeacherCourseGraphPage /></Guard>} />
      <Route path="/teacher/courses/:courseId/nodes/:nodeId" element={<Guard role="teacher"><TeacherNodeEditorPage /></Guard>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

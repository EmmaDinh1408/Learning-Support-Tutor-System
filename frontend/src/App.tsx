import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';
import LoginPage from './pages/LoginPage';
import StudentCoursesPage from './pages/StudentCoursesPage';
import StudentCourseGraphPage from './pages/StudentCourseGraphPage';
import TeacherCoursesPage from './pages/TeacherCoursesPage';
import TeacherCourseGraphPage from './pages/TeacherCourseGraphPage';
import TeacherNodeEditorPage from './pages/TeacherNodeEditorPage';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/Dashboard';
import StudentCourseDetailPage from './pages/StudentCourseDetailPage';
import StudentProfilePage from './pages/StudentProfilePage';
import TeacherProfilePage from './pages/TeacherProfilePage';
import TeacherCourseDetailPage from './pages/TeacherCourseDetailPage';
import CourseAssignmentsPage from './pages/CourseAssignmentsPage';
import StudentQuizPage from './pages/StudentQuizPage';
import StudentGradesOverviewPage from './pages/StudentGradesOverviewPage';
import CourseAnnouncementsPage from './pages/CourseAnnouncementsPage';
import CourseFilesPage from './pages/CourseFilesPage';
import CourseQuizzesPage from './pages/CourseQuizzesPage';
import CourseAttendancePage from './pages/CourseAttendancePage';
import MessagesPage from './pages/MessagesPage';
import type { Role } from './types';
import type { ReactNode } from 'react';

function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'teacher' ? '/teacher/courses' : '/courses'} replace />;
  return <>{children}</>;
}

function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/home" element={<SignedIn><HomePage /></SignedIn>} />
      <Route path="/dashboard" element={<SignedIn><DashboardPage /></SignedIn>} />
      <Route path="/messages" element={<SignedIn><MessagesPage /></SignedIn>} />
      <Route path="/courses" element={<Guard role="student"><StudentCoursesPage /></Guard>} />
      <Route path="/profile/student" element={<Guard role="student"><StudentProfilePage /></Guard>} />
      <Route path="/grades" element={<Guard role="student"><StudentGradesOverviewPage /></Guard>} />
      <Route path="/courses/:courseId/assignments" element={<Guard role="student"><CourseAssignmentsPage /></Guard>} />
      <Route path="/courses/:courseId/announcements" element={<Guard role="student"><CourseAnnouncementsPage /></Guard>} />
      <Route path="/courses/:courseId/quizzes" element={<Guard role="student"><CourseQuizzesPage /></Guard>} />
      <Route path="/courses/:courseId/attendance" element={<Guard role="student"><CourseAttendancePage /></Guard>} />
      <Route path="/courses/:courseId/quizzes/:quizId" element={<Guard role="student"><StudentQuizPage /></Guard>} />
      <Route path="/courses/:courseId/graph" element={<Guard role="student"><StudentCourseGraphPage /></Guard>} />
      <Route path="/courses/:courseId/:tab" element={<Guard role="student"><StudentCourseDetailPage /></Guard>} />
      <Route path="/teacher/courses" element={<Guard role="teacher"><TeacherCoursesPage /></Guard>} />
      <Route path="/profile/teacher" element={<Guard role="teacher"><TeacherProfilePage /></Guard>} />
      <Route path="/teacher/courses/:courseId/assignments" element={<Guard role="teacher"><CourseAssignmentsPage /></Guard>} />
      <Route path="/teacher/courses/:courseId/announcements" element={<Guard role="teacher"><CourseAnnouncementsPage /></Guard>} />
      <Route path="/teacher/courses/:courseId/quizzes" element={<Guard role="teacher"><CourseQuizzesPage /></Guard>} />
      <Route path="/teacher/courses/:courseId/attendance" element={<Guard role="teacher"><CourseAttendancePage /></Guard>} />
      <Route path="/teacher/courses/:courseId/files" element={<Guard role="teacher"><CourseFilesPage /></Guard>} />
      <Route path="/teacher/courses/:courseId/graph" element={<Guard role="teacher"><TeacherCourseGraphPage /></Guard>} />
      <Route path="/teacher/courses/:courseId/:tab" element={<Guard role="teacher"><TeacherCourseDetailPage /></Guard>} />
      <Route path="/teacher/courses/:courseId/nodes/:nodeId" element={<Guard role="teacher"><TeacherNodeEditorPage /></Guard>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

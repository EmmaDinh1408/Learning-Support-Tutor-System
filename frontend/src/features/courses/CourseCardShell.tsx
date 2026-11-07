import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CourseTheme } from '../../types';

interface Props {
  code: string;
  theme: CourseTheme;
  faculty: string;
  title: string;
  to: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function CourseCardShell({ code, theme, faculty, title, to, children, footer }: Props) {
  return (
    <article className="course-card">
      <Link to={to} className={`course-banner theme-${theme}`}><span>{code}</span></Link>
      <div className="course-body">
        <div className="course-faculty">{faculty}</div>
        <Link to={to} className="course-title">{title}</Link>
        {children}
        <div className="course-foot">
          <div>{footer}</div>
          <button className="more" aria-label="Thêm"><MoreHorizontal size={14} /></button>
        </div>
      </div>
    </article>
  );
}

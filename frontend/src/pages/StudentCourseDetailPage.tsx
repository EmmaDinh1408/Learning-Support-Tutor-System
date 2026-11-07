import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Edit3, FileText, Sigma, Users } from 'lucide-react';
import { AppHeader } from '../features/layout/AppHeader';
import { useLanguage } from '../features/i18n/LanguageContext';

type DetailTab = 'content' | 'grades' | 'competencies';

interface ResourceItem {
  id: string;
  nameVi: string;
  nameEn: string;
}

interface CourseSection {
  id: string;
  titleVi: string;
  titleEn: string;
  badgeVi?: string;
  badgeEn?: string;
  items: ResourceItem[];
}

const SECTIONS: CourseSection[] = [
  { id: 'announcements', titleVi: 'Thông báo', titleEn: 'Announcements', items: [] },
  { id: 'assignments', titleVi: 'Bài tập lớn', titleEn: 'Large assignments', items: [] },
  {
    id: 'materials',
    titleVi: 'Tài liệu môn học',
    titleEn: 'Course materials',
    items: [
      { id: 'm1', nameVi: 'Đề cương môn học', nameEn: 'Course syllabus' },
      { id: 'm2', nameVi: 'Sách tham khảo 1', nameEn: 'Reference book 1' },
      { id: 'm3', nameVi: 'Sách tham khảo số 2', nameEn: 'Reference book 2' },
    ],
  },
  {
    id: 'quizzes',
    titleVi: 'Đề ôn luyện và Quiz',
    titleEn: 'Practice exercises and quizzes',
    badgeVi: 'Chưa mở',
    badgeEn: 'Not available',
    items: [],
  },
  {
    id: 'ch0',
    titleVi: 'Chương 1',
    titleEn: 'Chapter 1',
    items: [{ id: 'c0_1', nameVi: 'Slide bài giảng C0', nameEn: 'Lecture slides C0' }],
  },
  {
    id: 'ch1',
    titleVi: 'Chương 2',
    titleEn: 'Chapter 2',
    items: [{ id: 'c1_1', nameVi: 'Slide bài giảng C1', nameEn: 'Lecture slides C1' }],
  },
];

const GRADES = [
  { category: 'manual', titleVi: 'Giữa kỳ', titleEn: 'Midterm', subVi: 'MỤC THỦ CÔNG', subEn: 'MANUAL ITEM', weight: '-', score: '9,00', range: '0-10', percentage: '60,00 %', feedback: '-', contribution: '-' },
  { category: 'manual', titleVi: 'BTL', titleEn: 'Course project', subVi: 'MỤC THỦ CÔNG', subEn: 'MANUAL ITEM', weight: '-', score: '-', range: '0-10', percentage: '-', feedback: '-', contribution: '-' },
  { category: 'manual', titleVi: 'Cuối kỳ', titleEn: 'Final exam', subVi: 'MỤC THỦ CÔNG', subEn: 'MANUAL ITEM', weight: '-', score: '-', range: '0-13', percentage: '-', feedback: '-', contribution: '-' },
  { category: 'attendance', titleVi: 'Điểm danh A01', titleEn: 'Attendance A01', subVi: 'Điểm danh', subEn: 'ATTENDANCE', weight: '-', score: '-', range: '0-100', percentage: '-', feedback: '-', contribution: '-' },
  { category: 'attendance', titleVi: 'Điểm danh A02', titleEn: 'Attendance A02', subVi: 'Điểm danh', subEn: 'ATTENDANCE', weight: '-', score: '100,00', range: '0-100', percentage: '100,00 %', feedback: '-', contribution: '-' },
];

export default function StudentCourseDetailPage() {
  const { courseId = 'MT2013' } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tab = (window.location.pathname.split('/').pop() || 'content') as DetailTab;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ materials: true, ch0: true });
  const isVi = language === 'vi';
  const courseName = useMemo(
    () => courseId === 'CO2003'
      ? 'Cấu trúc dữ liệu và giải thuật (CO2003)'
      : `${courseId} - ${isVi ? 'Tên khóa học' : 'Course name'}`,
    [courseId, isVi],
  );

  const tabs: { id: DetailTab | 'graph'; label: string }[] = [
    { id: 'graph', label: isVi ? 'Bản đồ' : 'Graph' },
    { id: 'content', label: isVi ? 'Nội dung' : 'Content' },
    { id: 'grades', label: isVi ? 'Điểm số' : 'Grades' },
    { id: 'competencies', label: isVi ? 'Năng lực' : 'Competencies' },
  ];

  const selectTab = (id: DetailTab | 'graph') => {
    navigate(id === 'graph' ? `/courses/${courseId}/graph` : `/courses/${courseId}/${id}`);
  };

  return (
    <div className="page course-detail-page">
      <AppHeader />
      <main className="container course-detail-content">
        <h1>{courseName}</h1>
        <div className="tabs-pill course-detail-tabs">
          {tabs.map((item) => (
            <button key={item.id} className={tab === item.id ? 'on' : ''} onClick={() => selectTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'content' && (
          <div className="course-detail-sections">
            <button className="course-collapse-all" onClick={() => setOpenSections({})}>
              {isVi ? 'Thu gọn toàn bộ' : 'Collapse all'}
            </button>
            {SECTIONS.map((section) => {
              const open = openSections[section.id];
              return (
                <div className="course-detail-section" key={section.id}>
                  <button className="course-detail-section-head" onClick={() => setOpenSections((current) => ({ ...current, [section.id]: !current[section.id] }))}>
                    <span className="course-section-title">
                      {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      {isVi ? section.titleVi : section.titleEn}
                    </span>
                    {(isVi ? section.badgeVi : section.badgeEn) && (
                      <span className="course-section-badge">{isVi ? section.badgeVi : section.badgeEn}</span>
                    )}
                  </button>
                  {open && (
                    section.items.length ? (
                      <div className="course-resource-list">
                        {section.items.map((item) => (
                          <a href="#download" key={item.id} className="course-resource">
                            <FileText size={16} />
                            <span>{isVi ? item.nameVi : item.nameEn}</span>
                            <small>PDF</small>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="course-empty-section">
                        {isVi ? 'Chưa có nội dung hoặc bài tập trong mục này.' : 'There is no content or assignment in this section yet.'}
                      </p>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'grades' && (
          <div className="course-grades-card">
            <div className="course-grades-heading"><ChevronDown size={15} /><strong>{courseName}</strong></div>
            <div className="course-grades-table-wrap">
              <table className="course-grades-table">
                <thead>
                  <tr>
                    <th>{isVi ? 'Mục điểm' : 'Grade item'}</th>
                    <th>{isVi ? 'Khối' : 'Weight'}</th>
                    <th>{isVi ? 'Điểm' : 'Grade'}</th>
                    <th>{isVi ? 'Khoảng' : 'Range'}</th>
                    <th>{isVi ? 'Phần trăm' : 'Percentage'}</th>
                    <th>{isVi ? 'Phản hồi' : 'Feedback'}</th>
                    <th>{isVi ? 'Đóng góp vào tổng môn học' : 'Contribution to course total'}</th>
                  </tr>
                </thead>
                <tbody>
                  {GRADES.map((row, index) => (
                    <tr key={index}>
                      <td><span className="grade-item-icon">{row.category === 'manual' ? <Edit3 size={14} /> : <Users size={14} />}</span><span><small>{isVi ? row.subVi : row.subEn}</small><strong>{isVi ? row.titleVi : row.titleEn}</strong></span></td>
                      <td>{row.weight}</td><td>{row.score}</td><td>{row.range}</td><td>{row.percentage}</td><td>{row.feedback}</td><td>{row.contribution}</td>
                    </tr>
                  ))}
                  <tr className="course-grade-total">
                    <td><Sigma size={15} /> {isVi ? 'Tổng khóa học' : 'Course total'}</td>
                    <td>-</td><td>-</td><td>0-110</td><td>-</td><td>-</td><td>-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'competencies' && (
          <div className="course-competencies-empty">
            <Users size={28} />
            <p>{isVi ? 'Không có chuẩn năng lực cụ thể nào được liên kết với khóa học này.' : 'No specific competencies are linked to this course.'}</p>
          </div>
        )}
      </main>
    </div>
  );
}

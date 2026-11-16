import { ChevronDown, LayoutGrid, Plus, Search } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface Props {
  statusOptions: string[];
  statusValue?: string;
  onStatusChange?: (v: string) => void;
  sortValue?: string;
  onSortChange?: (v: string) => void;
  teacher?: boolean;
  onCreate?: () => void;
  query: string;
  onQuery: (v: string) => void;
}

export function CourseToolbar({
  statusOptions,
  statusValue,
  onStatusChange,
  sortValue,
  onSortChange,
  teacher,
  onCreate,
  query,
  onQuery,
}: Props) {
  const { language, t } = useLanguage();
  const isVi = language === 'vi';
  return (
    <div className="course-toolbar">
      <div className="tb-left">
        <label className="select">
          <select value={statusValue ?? statusOptions[0]} onChange={(e) => onStatusChange?.(e.target.value)}>
            {statusOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <ChevronDown size={12} />
        </label>
        <label className="search">
          <Search size={12} />
          <input placeholder={t('search')} value={query} onChange={(e) => onQuery(e.target.value)} />
        </label>
        <label className="select wide">
          <select value={sortValue ?? 'title'} onChange={(e) => onSortChange?.(e.target.value)}>
            <option value="title">{isVi ? 'Sắp xếp theo tên khoá học' : 'Sort by course title'}</option>
            <option value="progress">{isVi ? 'Sắp xếp theo tiến độ' : 'Sort by progress'}</option>
          </select>
          <ChevronDown size={12} />
        </label>
      </div>
      <div className="tb-right">
        <label className="select view">
          <LayoutGrid size={12} />
          <select>
            <option>{isVi ? 'Thẻ' : 'Card'}</option>
            <option>{isVi ? 'Danh sách' : 'List'}</option>
          </select>
          <ChevronDown size={12} />
        </label>
        {teacher && (
          <button className="btn btn-outline" onClick={onCreate}>
            <Plus size={12} /> {t('createCourse')}
          </button>
        )}
      </div>
    </div>
  );
}

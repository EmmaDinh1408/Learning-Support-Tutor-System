import { ChevronDown, LayoutGrid, Plus, Search } from 'lucide-react';

interface Props {
  statusOptions: string[];
  teacher?: boolean;
  onCreate?: () => void;
  query: string;
  onQuery: (v: string) => void;
}

export function CourseToolbar({ statusOptions, teacher, onCreate, query, onQuery }: Props) {
  return (
    <div className="course-toolbar">
      <div className="tb-left">
        <label className="select"><select>{statusOptions.map((o) => <option key={o}>{o}</option>)}</select><ChevronDown size={12} /></label>
        <label className="search"><Search size={12} /><input placeholder="Tìm kiếm" value={query} onChange={(e) => onQuery(e.target.value)} /></label>
        <label className="select wide"><select><option>Sắp xếp theo tên khoá học</option><option>Sắp xếp theo tiến độ</option></select><ChevronDown size={12} /></label>
      </div>
      <div className="tb-right">
        <label className="select view"><LayoutGrid size={12} /><select><option>Thẻ</option><option>Danh sách</option></select><ChevronDown size={12} /></label>
        {teacher && <button className="btn btn-outline" onClick={onCreate}><Plus size={12} /> Tạo khóa học</button>}
      </div>
    </div>
  );
}

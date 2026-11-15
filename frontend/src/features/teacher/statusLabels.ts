import type { ContentItem, TeacherNode } from '../../types';

export function teacherNodeStatusLabel(status: TeacherNode['status']): string {
  switch (status) {
    case 'approved': return 'Đã duyệt';
    case 'draft': return 'Bản nháp';
    case 'pending_review': return 'Chờ duyệt';
    case 'outside_cluster': return 'Ngoài cụm';
  }
}

export function contentStatusLabel(status: ContentItem['status']): string {
  return status === 'approved' ? 'Đã duyệt' : 'Bản nháp';
}

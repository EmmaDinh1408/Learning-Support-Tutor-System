MERGE (s1:HomeSlide {id: 'guide'})
SET s1.titleVi = 'Hướng dẫn sử dụng hệ thống',
    s1.titleEn = 'System user guide',
    s1.subtitleVi = 'Dành cho Giảng viên & Sinh viên',
    s1.subtitleEn = 'For lecturers and students',
    s1.linkVi = 'Xem chi tiết',
    s1.linkEn = 'View details',
    s1.imageUrl = 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=1600&auto=format&fit=crop',
    s1.sequence = 1;

MERGE (s2:HomeSlide {id: 'activities'})
SET s2.titleVi = 'Thông tin Hoạt động Sinh viên',
    s2.titleEn = 'Student Activities',
    s2.subtitleVi = 'Student Affairs & Ngoại khóa 2026',
    s2.subtitleEn = 'Student affairs and extracurricular activities',
    s2.linkVi = 'Khám phá ngay',
    s2.linkEn = 'Explore now',
    s2.imageUrl = 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop',
    s2.sequence = 2;

MERGE (s3:HomeSlide {id: 'academic'})
SET s3.titleVi = 'Thông báo Học vụ & Đăng ký môn',
    s3.titleEn = 'Academic Notices & Course Registration',
    s3.subtitleVi = 'Kế hoạch đào tạo và thời khóa biểu học kỳ mới',
    s3.subtitleEn = 'Academic plan and the new semester timetable',
    s3.linkVi = 'Xem lịch trình',
    s3.linkEn = 'View schedule',
    s3.imageUrl = 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?q=80&w=1600&auto=format&fit=crop',
    s3.sequence = 3;

MERGE (st1:LoginStat {id: 'learners'})
SET st1.value = '12,400+', st1.labelVi = 'Học viên', st1.labelEn = 'Learners', st1.sequence = 1;

MERGE (st2:LoginStat {id: 'courses'})
SET st2.value = '380', st2.labelVi = 'Khóa học', st2.labelEn = 'Courses', st2.sequence = 2;

MERGE (st3:LoginStat {id: 'completion'})
SET st3.value = '98%', st3.labelVi = 'Hoàn thành', st3.labelEn = 'Completion', st3.sequence = 3;

MERGE (ga1:Announcement {id: 'ann_global_1'})
SET ga1.title = 'Tuyển sinh sau đại học 2026',
    ga1.body = 'Phòng Đào tạo Sau đại học thông báo kế hoạch tuyển sinh đợt 1 năm 2026 cho các ngành Kỹ thuật Máy tính và Khoa học Máy tính.',
    ga1.status = 'published',
    ga1.isGlobal = true,
    ga1.authorName = 'Phòng Đào tạo',
    ga1.createdAt = '2026-11-10T08:00:00Z',
    ga1.publishedAt = '2026-11-10T08:00:00Z';

MERGE (ga2:Announcement {id: 'ann_global_2'})
SET ga2.title = 'Lịch thi cuối kỳ học kỳ 1 đã được công bố',
    ga2.body = 'Sinh viên kiểm tra lịch thi cuối kỳ chính thức và phòng thi trên cổng thông tin đào tạo.',
    ga2.status = 'published',
    ga2.isGlobal = true,
    ga2.authorName = 'Phòng Khảo thí & ĐBCL',
    ga2.createdAt = '2026-11-08T09:30:00Z',
    ga2.publishedAt = '2026-11-08T09:30:00Z';

MERGE (ga3:Announcement {id: 'ann_global_3'})
SET ga3.title = 'Hội thảo Công nghệ Phần mềm & AI trong Giáo dục',
    ga3.body = 'Khoa KH&KT Máy tính tổ chức hội thảo chuyên đề về ứng dụng Knowledge Graph và Microlearning trong đào tạo đại học.',
    ga3.status = 'published',
    ga3.isGlobal = true,
    ga3.authorName = 'Khoa KH&KT Máy tính',
    ga3.createdAt = '2026-11-05T14:00:00Z',
    ga3.publishedAt = '2026-11-05T14:00:00Z';

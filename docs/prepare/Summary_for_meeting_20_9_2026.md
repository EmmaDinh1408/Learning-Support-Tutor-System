# BIÊN BẢN CUỘC HỌP (MINUTES OF MEETING)

**Tài liệu tham khảo:** Recording 2026-09-20 101831.txt
**Thành phần tham dự:** Giảng viên hướng dẫn (TS. Nguyễn Quang Hùng) và các nhóm sinh viên (Nhóm 028, Nhóm 025)

---

## 1. NỘI DUNG TRAO ĐỔI VỚI NHÓM 028
**Chủ đề:** Phát triển nền tảng học tập/chấm thi tích hợp AI.

### 1.1. Cập nhật giao diện & Phân quyền
*   **Giao diện (UI):** Đã sửa lại trang `section.php` thiết kế rõ ràng hơn, cho phép chọn từng file cụ thể.
*   **Vai trò Sinh viên:**
    *   Được phép tóm tắt (Summarize) và giải thích tài liệu tải lên.
    *   Có thể tự tạo Quiz/Game để ôn tập từ tài liệu tải lên (PDF, file...). Không gán deadline cho dạng tự tạo này.
*   **Vai trò Giảng viên:**
    *   Tạo câu hỏi, bài giảng, gán thời hạn (deadline) làm bài cho cả lớp.
    *   Chấm bài tập lớn, Assignment, Lab qua file PDF report bằng AI.
    *   **Mở rộng chấm Source Code:** Chấm tự động qua Test case. AI sẽ phân tích code (đúng/sai, hiệu quả, bắt được bao nhiêu test case trong tổng số ví dụ 100 test case) và xuất ra điểm số.

### 1.2. Tối ưu kiến trúc AI (AI Router / Scheduler)
*   **Định tuyến AI (AI Router):** Phân loại task để điều phối đến các mô hình AI phù hợp nhằm tối ưu chi phí vận hành.
    *   *Task phức tạp:* Dùng các mô hình mạnh (như GPT-4.0, GPT-5, Claude...) để tránh ảo giác (hallucination).
    *   *Task đơn giản/Trích xuất hình ảnh:* Dùng các tool rẻ tiền hoặc thư viện mã nguồn mở trước (ví dụ: OpenCV cho Computer Vision) để trích xuất thông tin, nếu không hiệu quả mới đẩy qua AI.
*   **Cấu hình Provider:** Hỗ trợ đa dạng provider ở tầng dưới (Gemini, Claude, GPT, các mô hình mở...).

### 1.3. Yêu cầu & Tiêu chí đánh giá đồ án
*   Mục tiêu để đạt điểm cao (>90): Có một bản Prototype ổn định (hoàn thành khoảng 80% sản phẩm) và một bản thiết kế rõ ràng, thuyết phục được tính khả thi.
*   Chức năng càng làm được nhiều, càng chi tiết và tối ưu hóa tốt (như cái AI Router) thì điểm càng cao.

---

## 2. NỘI DUNG TRAO ĐỔI VỚI NHÓM 025
**Chủ đề:** Xây dựng hệ thống học tập linh hoạt dựa trên Cây tri thức (Knowledge Graph).

### 2.1. Ý tưởng cốt lõi (Knowledge Graph)
*   Mỗi môn học (vd: Điện toán đám mây) hoặc chương trình học (gồm nhiều môn) sẽ được xây dựng thành một **Đồ thị tri thức (Knowledge Graph)**.
*   **Mục tiêu:** Cho phép sinh viên có lộ trình học tập linh hoạt, cá nhân hóa (đi đường vòng, chia nhỏ ra học nhiều lần, học trước học sau...) nhưng đích đến cuối cùng vẫn phải đáp ứng đủ **Chuẩn đầu ra**.
*   **Các loại liên kết (Nodes/Edges):** Xác định rõ mối quan hệ giữa các kiến thức, các môn học (Môn học tiên quyết bắt buộc, Môn học trước không bắt buộc...).

### 2.2. Phân rã nội dung học tập (Micro-content)
*   Tránh để một Slide/Chương học dài làm một Node (nút) duy nhất.
*   Cần phân rã slide/bài giảng thành các đơn vị kiến thức nhỏ (Micro-content). Ví dụ: Hệ điều hành -> Process -> Định thời -> Giải thuật định thời cụ thể.

### 2.3. Công nghệ và Phương pháp đề xuất
*   Nghiên cứu sử dụng các tool AI để trích xuất dữ liệu từ Text và Hình ảnh (PDF slides) thành các Node trên đồ thị.
*   **Công cụ Gợi ý:**
    *   Tham khảo Neo4j (Graph Database) hoặc các tool xây dựng graph khác.
    *   Nếu xử lý đồ thị lớn (Big Data), có thể nghiên cứu dùng **Apache Spark** (GraphX). Nếu đưa được Spark vào đồ án để xử lý sẽ là một đóng góp rất tốt.

---

## 3. CÁC BƯỚC TIẾP THEO (NEXT STEPS)
*   Các nhóm tự do đề xuất và thử nghiệm các công nghệ/phương pháp. Thầy chỉ định hướng, sinh viên cần mạnh dạn làm.
*   Sinh viên note lại các câu hỏi thắc mắc chưa kịp hỏi và gửi qua Email hoặc Google Sheet cho giảng viên.
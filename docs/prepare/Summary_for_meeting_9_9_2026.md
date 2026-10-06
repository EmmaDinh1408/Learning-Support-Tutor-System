# Biên Bản Cuộc Họp (MOM) - Phân công đồ án hệ thống LMS & AI

**Tài liệu tham khảo:** Recording 2026-09-09 211239.txt[cite: 2]

## 1. Thông tin chung
* **Nội dung chính:** Phân công vai trò thành viên nhóm, thảo luận kiến trúc hệ thống và lựa chọn AI model cho đồ án[cite: 2].
* **Thành viên được nhắc đến:** Thầy vs nhóm 028.
* **Kinh nghiệm cá nhân (Trí):** Có thế mạnh về Backend, từng làm Intern Backend cho dự án bệnh viện (sử dụng Whisper chuyển giọng nói thành văn bản, dùng FFmpeg để ngắt giọng bác sĩ và dùng Gemini API để tự động điền form)[cite: 2].

## 2. Phân công 5 vai trò chính trong nhóm
* **Vai trò 1: Kỹ sư Frontend và Trải nghiệm người dùng (UI/UX)**
    * Chịu trách nhiệm thiết kế giao diện đảm bảo các tiêu chí: nhanh, đẹp, dễ sử dụng và chạy tốt trên nhiều loại thiết bị khác nhau[cite: 2].
    * Tự do lựa chọn Framework Frontend nào phù hợp nhất với dự án[cite: 2].
* **Vai trò 2: Kỹ sư AI & LLM**
    * Nghiên cứu và lựa chọn các mô hình AI nền tảng phù hợp cho từng chức năng riêng biệt (ví dụ: GPT 4/5/5.6, Gemini, Claude 3.1 Pro/5, DeepSeek, V4)[cite: 2].
    * Thiết lập hệ thống Multi-AI-Provider trong LMS (ví dụ: tạo câu hỏi dùng GPT/Gemini, lập trình dùng Claude, tạo video thì ưu tiên model cân bằng được giữa chi phí và chất lượng)[cite: 2].
    * Xây dựng kiến trúc RAG (Retrieval-Augmented Generation) để giảm thiểu tình trạng AI sinh ảo giác, đảm bảo nội dung tạo ra bám sát 100% tài liệu gốc của giáo viên[cite: 2].
    * Áp dụng các kỹ thuật Prompt Engineering (Chuỗi suy nghĩ - Chain of Thought, Multi-agent, Few-shot) để AI sinh ra nội dung (microcontent) với định dạng chuẩn và độ chính xác cao[cite: 2].
* **Vai trò 3: Kỹ sư Backend & Dữ liệu**
    * Xây dựng luồng dữ liệu và phần khung Backend kết nối với module AI thông qua các giao thức như REST API hoặc GraphQL[cite: 2].
    * Thiết kế cơ sở dữ liệu, bao gồm cả Vector Database phục vụ cho việc dò tìm dữ liệu chính xác[cite: 2].
    * Đảm nhiệm luồng tiền xử lý dữ liệu: bóc tách và cắt nhỏ dữ liệu từ file PDF, slide hay sách dày thành từng chương để AI có thể tóm tắt và xử lý hiệu quả[cite: 2].
* **Vai trò 4: Kiểm tra chất lượng (QA/Verify)**
    * Phụ trách kiểm tra, đảm bảo độ chính xác và tính phù hợp của các câu hỏi trắc nghiệm do AI sinh ra[cite: 2].
    * Sử dụng slide tài liệu của các môn học cũ làm dữ liệu đối chiếu và kiểm thử[cite: 2].
* **Vai trò 5: Quản lý dự án (Project Manager)**
    * Chịu trách nhiệm quản lý chung tiến độ cho toàn bộ dự án[cite: 2].
    * Nếu nhóm có ít thành viên, có thể linh hoạt gộp các vai trò lại với nhau (ví dụ gộp vai trò 4 với 5, hoặc vai trò 2 với 3)[cite: 2].

## 3. Kiến trúc Hệ thống LMS & Môi trường Triển khai
* Nên tận dụng các nền tảng LMS mã nguồn mở có sẵn như Moodle (viết bằng PHP) hoặc OpenLMS để quản lý khóa học, người dùng thay vì tự lập trình lại từ đầu[cite: 2].
* Phần AI Core nên được tách riêng thành một service bên ngoài và giao tiếp với hệ thống LMS gốc thông qua giao thức LTI (Learning Tools Interoperability) để tiết kiệm thời gian[cite: 2].
* Nhóm cần tìm hiểu thêm các công cụ hỗ trợ cho giáo viên trên nền tảng Khan Academy để tham khảo ý tưởng chuyên môn hóa[cite: 2].
* Môi trường triển khai nên sử dụng Docker, Kubernetes (K3s), Terraform để chạy trên nhiều cloud và khuyến khích áp dụng CI/CD[cite: 2].

## 4. Nguyên tắc làm việc nhóm
* **Quy tắc Backup:** Mỗi vai trò chính bắt buộc phải có thành viên khác làm phương án dự phòng (backup)[cite: 2]. Thành viên backup phải nắm rõ tiến độ công việc để đảm bảo dự án không bị đình trệ nếu người phụ trách chính nghỉ[cite: 2].
* **Quy tắc Bảo mật:** Tuyệt đối chỉ chia sẻ source code với Thầy trong quá trình làm để tránh bị hệ thống quét đạo văn trùng lặp; chỉ public source code sau khi đã hoàn thành báo cáo[cite: 2].
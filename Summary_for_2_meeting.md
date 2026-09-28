# BIÊN BẢN CUỘC HỌP (MOM) - ĐỒ ÁN MÔN HỌC
**Nguồn dữ liệu tham khảo:** Tệp "Họp Đồ Án Buổi 2.txt"

## 1. Thành phần tham dự
* **Thầy giáo hướng dẫn:** TS. Nguyễn Quang Hùng (002609).
* **Nhóm sinh viên thực hiện đồ án:** Nhóm 033.

## 2. Nội dung thảo luận chính

### A. Vấn đề xử lý tài liệu đầu vào (Tài liệu giáo trình/Textbook)
* Tuyệt đối không upload toàn bộ tài liệu dài hàng ngàn trang vào các mô hình AI vì sẽ gây tốn kém chi phí cực lớn (ví dụ: mô hình Claude thu 1 đô la cho mỗi 128 ngàn token).
* Việc đưa ngữ cảnh quá lớn vào AI sẽ làm giảm khả năng ghi nhớ và độ chính xác của mô hình.
* **Giải pháp:** Phải chia nhỏ tài liệu theo từng chương hoặc từng phần dựa trên bố cục sẵn có của sách.
* Cần xây dựng công cụ cho phép giáo viên tự cắt tài liệu theo chương/phần, hoặc yêu cầu giáo viên phải lọc tài liệu trước khi đưa lên hệ thống.
* Để trích xuất nội dung hiệu quả, nên tận dụng phần mục lục hoặc bảng từ khóa (glossary/index) ở cuối các cuốn sách để tìm ra các thuật ngữ quan trọng và chỉ số trang.
* Đối với tài liệu dạng slide, có thể sử dụng LLM đọc phần outline để tìm từ khóa (keyword), từ đó xây dựng một đồ thị (Graph) liên kết các từ khóa này trước khi sinh ra nội dung chi tiết.
* **Chiến lược phát triển:** Bắt đầu giải quyết bài toán ở quy mô nhỏ (một chương sách hoặc một slide) trước khi mở rộng.

### B. Xây dựng nội dung Microlearning
* Microlearning là tập hợp của nhiều hoạt động nhỏ trong một chương hoặc một slide.
* Mỗi bài học microlearning chỉ nên chứa 1 đến 2 chủ đề nhỏ, với thời lượng kéo dài không quá 10 phút.
* **Về định dạng đầu ra:** Nên giữ nội dung (text, quiz) trực tiếp trên hệ thống dưới dạng Markdown và ghi rõ nguồn gốc thay vì cho phép xuất ra các định dạng như `.pptx` hay HTML5 để tránh các vấn đề liên quan đến bản quyền.

### C. Tích hợp Hệ thống Quản lý Học tập (LMS) cho Giai đoạn 2
* Thầy giáo khuyên nhóm không nên tự xây dựng hệ thống LMS từ đầu vì sẽ rất mất thời gian.
* Nên sử dụng hệ thống **Moodle phiên bản 5.2** vì đây là nền tảng phổ biến, có cộng đồng hỗ trợ lớn và dễ dàng viết các plugin tích hợp.
* Sinh viên có thể sử dụng các công cụ lập trình AI (như Claude) để hỗ trợ viết code cho Moodle.
* **Cách cài đặt:** Có thể tải mã nguồn từ `moodle.org` (file zip) hoặc clone trực tiếp từ GitHub qua VSCode (chỉ mất khoảng 5 phút).
* Môi trường chạy local yêu cầu Apache và MySQL.

### D. Công cụ tạo câu hỏi tự động (AI Quiz Generator)
* Hệ thống cần phân loại câu hỏi dựa trên **thang đo nhận thức Bloom** gồm 6 mức độ: Nhớ (Remember), Hiểu (Understand), Vận dụng (Apply), Phân tích (Analyze), Đánh giá và Sáng tạo.
* Cho phép người dùng linh hoạt cấu hình mô hình AI (Claude, Gemini, v.v.) tùy thuộc vào độ phức tạp của công việc để tối ưu chi phí (những tác vụ đơn giản nên dùng mô hình rẻ tiền hơn).
* Giáo viên có quyền cấu hình prompt, định dạng tên/mã số câu hỏi (ví dụ: chương, ngày tháng, số thứ tự câu hỏi).
* Câu hỏi sau khi sinh ra, nếu giáo viên đồng ý, sẽ được import thẳng vào ngân hàng câu hỏi của Moodle.

### E. Tương tác với người dùng & Đánh giá nội dung
* Hệ thống cần có bước hỏi ý kiến giáo viên để xác định mức độ kiến thức mong muốn (ví dụ: muốn tạo bài học/câu hỏi từ mức độ "Vận dụng" trở lên).
* Để tạo video bài giảng, có thể dùng LLM sinh ra video ngắn hoặc trích xuất nội dung từ các video ngắn trên YouTube.
* Cần có sự đánh giá của con người (giáo viên) đối với nội dung AI tạo ra để kiểm tra tính chính xác và tránh hiện tượng ảo giác (hallucination) của AI.

## 3. Kế hoạch hành động (Action Items / Next Steps)

- [ ] **Nhóm sinh viên:** Tìm hiểu và cài đặt phiên bản Moodle 5.2 trên môi trường local (Apache, MySQL) qua VSCode.
- [ ] **Nhóm sinh viên:** Triển khai tính năng xử lý tài liệu theo hướng cắt nhỏ và trích xuất keyword, xây dựng Graph.
- [ ] **Thầy hướng dẫn:** Sẽ hỗ trợ đánh giá (validate) nội dung AI sinh ra đối với các môn thầy đang phụ trách như Cloud Computing, Big Data, và Hệ điều hành.
- [ ] **Nhóm sinh viên:** Đối với các môn học khác không do thầy phụ trách, nhóm cần làm khảo sát (survey) với các bạn trong lớp hoặc trong nhóm để lấy ý kiến đánh giá.
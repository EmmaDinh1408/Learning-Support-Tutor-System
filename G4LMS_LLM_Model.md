# Đề xuất mô hình LLM cho hệ gợi ý G4LMS

## 1. Vai trò của LLM trong hệ thống

Các biến đầu vào của mô hình gợi ý (GPA, môn đã học, sở thích/sở trường, kết quả quiz của các node đã học) do **Neo4j và Cypher xử lý**. LLM chỉ **nhận kết quả đó rồi viết lời giải thích**, không quyết định chọn bài nào. Vì vậy chọn model theo tác vụ, không cần model mạnh nhất.

| Thành phần | Ai làm |
|---|---|
| Lưu đồ thị tri thức, quan hệ tiền đề, mức thành thạo | Neo4j |
| Truy vấn ngược tiền đề, tổng hợp % sai theo concept | Cypher |
| Công thức điểm, trọng số, confidence | Python |
| Tạo embedding | Model embedding bên ngoài |
| Viết lời giải thích, sinh quiz, trích keyword | LLM |

---

## 2. Danh sách model đề xuất

| Model | Loại | Dùng cho việc gì | Ghi chú |
|---|---|---|---|
| Gemini 2.5 Flash-Lite | Rẻ nhất | Giải thích gợi ý, phân loại, trích thông tin | Khoảng $0,10 input / $0,40 output mỗi 1 triệu token |
| Gemini 3.1 Flash-Lite | Rẻ, đời mới | Giải thích gợi ý (AI Tutor) | $0,25 input / $1,50 output mỗi 1 triệu token |
| Gemini 2.5 Flash | Tầm trung, bản ổn định | Sinh quiz theo Bloom, trích keyword từ giáo trình | $0,30 input / $2,50 output, không phải bản preview |
| Gemini 3.5 Flash | Tầm trung, mới hơn | Tác vụ cần hiểu sâu hơn | Standard $1,50 input / $9,00 output |
| Claude Haiku 4.5 | Nhỏ, nhanh | Giải thích gợi ý | Chưa tra giá, cần xem trang giá Anthropic |
| Claude Sonnet 5 | Tầm trung | Sinh quiz, dựng graph từ giáo trình | Chưa tra giá, cần xem trang giá Anthropic |
| Gemma 4 / Qwen / Llama | Mã nguồn mở, chạy local | Giải thích khi lo chi phí hoặc bảo mật dữ liệu sinh viên | Chất lượng tiếng Việt cần tự kiểm tra |
| bge-m3 / multilingual-e5 | Embedding | Tạo vector cho vector index của Neo4j | Chạy local, đa ngôn ngữ, không phải LLM chat |

> Giá lấy từ các trang tổng hợp bên thứ ba (khoảng tháng 4 đến tháng 7/2026) và thay đổi khá thường xuyên. Cần xác nhận trên trang giá chính thức trước khi ghi vào báo cáo.

---

## 3. Tính năng LLM đảm nhận

| Tính năng | Đầu vào lấy từ | Nhóm model phù hợp |
|---|---|---|
| Giải thích vì sao gợi ý bài này | Đường đi graph + kết quả quiz | Nhóm rẻ (Flash-Lite, Haiku) |
| Tóm tắt lộ trình học cho sinh viên | Danh sách bài đã xếp hạng + mục tiêu, sở thích | Nhóm rẻ |
| Sinh câu hỏi quiz theo thang Bloom | Nội dung một chương | Nhóm tầm trung |
| Trích keyword, đề xuất node/cạnh từ giáo trình | Outline, mục lục | Nhóm tầm trung, giáo viên duyệt lại |
| Chuyển sở thích/mục tiêu viết tự do thành concept trong graph | Câu sinh viên nhập | Nhóm rẻ + embedding |

---

## 4. Lưu ý

- **GPA và sở trường** chỉ nên là tín hiệu phụ trong công thức điểm, không đưa cho LLM tự suy đoán. Việc chọn bài do Cypher và công thức quyết định.
- **Free tier có đánh đổi:** một nguồn ghi rằng ở gói miễn phí, nội dung có thể được dùng để cải thiện sản phẩm. Nếu dùng dữ liệu sinh viên thật, nên dùng gói trả phí hoặc model local.
- **Tách lớp provider:** viết một interface `generate(prompt)` và cấu hình model qua file config để đổi Claude, Gemini hay model local mà không sửa code (khớp gợi ý đa provider của thầy ở buổi 20/9).
- **Có phương án dự phòng:** câu giải thích theo template từ đường đi graph khi API lỗi hoặc hết ngân sách.
- **Claude không có model embedding**, nên phần vector index phải dùng nguồn khác (bge-m3, multilingual-e5, hoặc API embedding của hãng khác).

---

## 5. Gợi ý chọn nhanh

1. **Giải thích gợi ý:** Gemini 2.5 Flash-Lite hoặc 3.1 Flash-Lite.
2. **Sinh quiz, trích keyword, dựng graph:** Gemini 2.5 Flash hoặc Claude Sonnet 5.
3. **Embedding:** bge-m3.
4. **Kiểm chứng:** viết khoảng 20 tình huống hổng kiến thức, chạy cùng prompt trên 2 đến 3 model, chấm theo ba tiêu chí:
   - Có nhắc bài ngoài graph không.
   - Có đảo chiều quan hệ tiền đề không.
   - Tiếng Việt có tự nhiên không.
5. Chọn model rẻ nhất mà vẫn đạt.

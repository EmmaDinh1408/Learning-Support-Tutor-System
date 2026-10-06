# Xác định Requirement — Đề tài Graph for LMS (G4LMS)
**Người trình bày:** Tăng Vũ & Hà
**Tuần:** 1 — Xác định requirement

---

## 1. Phạm vi (Scope)

G4LMS là một nền tảng học tập (LMS) tổ chức kiến thức dưới dạng **cây/đồ thị tri thức** thay vì danh sách bài học tuyến tính. Mỗi đơn vị kiến thức là một **node** (bài học, khái niệm, hoặc kỹ năng), được liên kết với nhau bằng các **edge** thể hiện quan hệ tiền đề (ví dụ: "A bổ trợ cho B", "A là cha của B").

Khi hệ thống phát hiện học viên yếu ở một node cụ thể, thay vì bắt học lại toàn bộ lộ trình, hệ thống sẽ:
- Truy vấn ngược trong đồ thị để tìm các node tiền đề liên quan đến lỗ hổng đó.
- Gợi ý các **micro-content** (bài học nhỏ) để lấp đúng lỗ hổng, tối ưu thời gian học.

**Trong phạm vi (In-scope) — Giai đoạn 1 & 2:**
- Xây dựng và quản lý cây tri thức trên Neo4j.
- CRUD micro-lesson (video, bài đọc, quiz).
- Quản lý người dùng và xác thực (Authentication).
- Theo dõi tiến độ học, phát hiện lỗ hổng kiến thức dựa trên kết quả quiz.
- Thuật toán gợi ý học lại dựa trên quan hệ tiền đề trong đồ thị.
- Trực quan hóa (Visualizer) mối quan hệ giữa các bài học.
- Dashboard "Bản đồ tri thức" cá nhân hóa và lộ trình học động (Dynamic Path).

**Ngoài phạm vi (Out-of-scope):**
- Tính năng lớp học trực tuyến (livestream, video call).
- Thanh toán / mua khóa học (thương mại hóa).
- Hệ thống chấm điểm tự động cho bài tự luận phức tạp (chỉ hỗ trợ quiz trắc nghiệm/dạng đóng ở phạm vi đồ án).
- Ứng dụng di động native (chỉ tối ưu giao diện web responsive cho mobile).

---

## 2. Danh sách Stakeholders

| Stakeholder | Vai trò / Lợi ích liên quan |
|---|---|
| **Học viên (Learner)** | Người dùng chính, học theo cây tri thức, nhận gợi ý cá nhân hóa |
| **Giáo viên / Người tạo nội dung (Content creator)** | Tạo, chỉnh sửa node kiến thức, thiết lập quan hệ tiền đề giữa các bài học |
| **Quản trị viên hệ thống (Admin)** | Quản lý user, phân quyền, giám sát vận hành hệ thống |
| **Giảng viên hướng dẫn** | Đánh giá tiến độ, nghiệm thu sản phẩm đồ án |
| **Nhóm phát triển (4 thành viên)** | Xây dựng, vận hành, bảo trì hệ thống trong suốt vòng đời đồ án |

---

## 3. Functional Requirements (Mức độ ưu tiên: 1 = thấp nhất, 5 = cao nhất)

| # | Chức năng | Mô tả | Ưu tiên | Giai đoạn |
|---|---|---|---|---|
| FR-01 | Quản lý đồ thị tri thức | CRUD node (bài học/khái niệm/kỹ năng) và edge (quan hệ tiền đề) trong Neo4j | 5 | GĐ1 |
| FR-02 | CRUD Micro-lesson | Tạo/sửa/xóa bài học nhỏ (video, bài đọc), gắn với node tương ứng | 5 | GĐ1 |
| FR-03 | Authentication & phân quyền | Đăng ký/đăng nhập, phân biệt vai trò Học viên / Giáo viên / Admin | 5 | GĐ1 |
| FR-04 | Quiz sau mỗi bài học | Tạo câu hỏi trắc nghiệm, chấm điểm, lưu kết quả theo từng node | 5 | GĐ1 |
| FR-05 | Phát hiện lỗ hổng kiến thức | Nếu học viên sai > 50% câu hỏi ở một node → đánh dấu node đó là "hổng" | 5 | GĐ2 |
| FR-06 | Gợi ý học lại (Recommendation) | Từ node hổng, truy vấn ngược các node tiền đề trong đồ thị, gợi ý học lại đúng phần thiếu | 5 | GĐ2 |
| FR-07 | Khóa/mở khóa bài học tuần tự | Học xong node A đạt yêu cầu → tự động mở khóa node B (quan hệ tiền đề) | 4 | GĐ1 |
| FR-08 | Visualizer quan hệ bài học | Hiển thị trực quan (dạng đồ thị) mối liên kết giữa các bài học cho học viên/giáo viên | 4 | GĐ1 |
| FR-09 | Nhập liệu hàng loạt (Bulk import) | Hỗ trợ nhập nhanh ~50 bài học mẫu và quan hệ giữa chúng để test hệ thống | 4 | GĐ1 |
| FR-10 | Dashboard "Bản đồ tri thức" cá nhân | Hiển thị bản đồ node theo màu (xanh = nắm vững, đỏ = hổng) cho từng học viên | 3 | GĐ2 |
| FR-11 | Lộ trình học động (Dynamic Path) | Lộ trình học thay đổi real-time dựa theo điểm số/kết quả quiz | 3 | GĐ2 |
| FR-12 | Thống kê thời gian học | Ghi nhận và hiển thị thời lượng học của từng học viên theo bài/theo tuần | 2 | GĐ2 |
| FR-13 | Giao diện tối ưu Mobile | Giao diện micro-learning responsive tốt trên thiết bị di động | 2 | GĐ2 |

---

## 4. Non-functional Requirements

| # | Yêu cầu | Mô tả |
|---|---|---|
| NFR-01 | Hiệu năng truy vấn đồ thị | Truy vấn quan hệ tiền đề (traversal) trên Neo4j phải trả kết quả trong thời gian chấp nhận được kể cả khi đồ thị mở rộng (>500 node) |
| NFR-02 | Khả năng mở rộng schema | Schema Node/Edge cần đủ linh hoạt để bổ sung loại quan hệ mới (không chỉ "bổ trợ cho"/"là cha của") mà không phá vỡ dữ liệu cũ |
| NFR-03 | Bảo mật dữ liệu người dùng | Mật khẩu mã hóa, phân quyền truy cập rõ ràng theo vai trò |
| NFR-04 | Khả năng bảo trì (Maintainability) | Code tách lớp rõ ràng (API, business logic, data access) để dễ mở rộng ở Giai đoạn 2 |
| NFR-05 | Tính khả dụng trên thiết bị di động | Giao diện đọc bài/xem video/làm quiz mượt trên màn hình nhỏ, vì đối tượng dùng chủ yếu học micro-learning trên điện thoại |
| NFR-06 | Khả năng kiểm thử (Testability) | Có khả năng nạp dữ liệu mẫu (~50 bài học) để test thuật toán gợi ý một cách độc lập với dữ liệu thật |

---

## 5. Assumptions & Constraints

**Assumptions (Giả định):**
- Dữ liệu mẫu (~50 bài học và quan hệ giữa chúng) do nhóm tự tạo thủ công để test thuật toán, không dùng dữ liệu thật từ người dùng thực tế trong giai đoạn phát triển.
- Học viên sử dụng hệ thống chủ yếu qua trình duyệt web (không yêu cầu app native).
- Nội dung micro-lesson (video, bài đọc, quiz) do giáo viên/nhóm phát triển tự chuẩn bị, hệ thống không tự sinh nội dung.

**Constraints (Ràng buộc):**
- Công nghệ bắt buộc theo đề tài: Graph Database (Neo4j), Python cho phần thuật toán gợi ý (Recommendation Algorithms).
- Nhóm phát triển chỉ có 4 thành viên, thời gian đồ án giới hạn trong 30 tuần (2 giai đoạn), cần ưu tiên đúng theo bảng FR ở trên để đảm bảo tiến độ.
- Phải nghiệm thu theo mốc: Demo Giai đoạn 1 (Tuần 14–15) và báo cáo tổng kết Giai đoạn 2 (Tuần 29–30).

---

## 6. Bổ sung Main Idea (optional)

- Tên phần mềm đề xuất: **Graph for LMS (G4LMS)**.
- Ý tưởng cốt lõi: nền tảng học tập chung, nhưng mỗi node kiến thức được cá nhân hóa tùy theo user — một node có thể được thể hiện bằng nhiều loại micro-content khác nhau (video, quiz, khóa học ngoài...).
- Điểm khác biệt so với LMS truyền thống: học viên không học tuyến tính theo chương trình cố định, mà theo đúng lỗ hổng kiến thức thực tế của bản thân, tiết kiệm thời gian ôn lại từ đầu.


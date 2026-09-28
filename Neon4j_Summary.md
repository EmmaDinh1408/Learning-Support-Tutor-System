# Phân tích dự án Knowledge Graph Builder và hướng áp dụng Neo4j cho LMS

> Lưu ý: Tài liệu này phân biệt rõ chức năng đã có trong mã nguồn với kiến trúc LMS được đề xuất; phần LMS hiện chưa được triển khai trong repository.

## 1. Tóm tắt điều hành

Đây là ứng dụng web xây dựng knowledge graph từ dữ liệu phi cấu trúc. Người dùng kết nối một cơ sở dữ liệu Neo4j, đưa tài liệu hoặc nguồn web vào, dùng LLM để trích xuất thực thể và quan hệ, sau đó duyệt đồ thị hoặc hỏi đáp trên nội dung đã nạp.

Các thành phần chính:

- **Frontend:** React + TypeScript + Vite; giao diện quản lý nguồn/tài liệu, cấu hình trích xuất, xem graph và chat.
- **Backend:** Python + FastAPI; tiếp nhận API, tải/chia nhỏ tài liệu, gọi LLM/embedding, đọc ghi Neo4j và chạy các tác vụ quản trị graph.
- **Graph database:** Neo4j; lưu nguồn, chunk, entity, cộng đồng, quan hệ và dữ liệu phục vụ tìm kiếm vector.
- **LLM/RAG:** LangChain tích hợp nhiều nhà cung cấp LLM và embedding; hỗ trợ hỏi đáp theo nhiều chế độ retrieval.

**Kết luận về LMS:** Có thể tái sử dụng nền tảng Neo4j, API FastAPI, khả năng embedding/vector search và một số kinh nghiệm RAG. Tuy nhiên, không nên xem ứng dụng hiện tại là LMS hoặc chỉ đổi tên các node hiện hữu: schema, phân quyền theo người học, tích hợp hệ thống LMS, lưu lịch sử học tập và logic gợi ý đều cần được thiết kế/bổ sung riêng.

## 2. Phạm vi và cấu trúc repository

### Thư mục và file cấp cao

- `backend/`: API, xử lý dữ liệu, tích hợp LLM/Neo4j, dependencies và một số bài kiểm tra/đo tải.
- `frontend/`: ứng dụng React/TypeScript, components, API client, trạng thái đăng nhập và giao diện graph/chat.
- `cronjob/`: hai job reset hạn mức token theo ngày/tháng; không phải bộ lập lịch học tập.
- `data/`: dữ liệu đánh giá/thử nghiệm, ví dụ so sánh LLM.
- `docs/`: tài liệu dự án và tài liệu backend/frontend.
- `experiments/`, `POC_Documents/`, `POC_Experiments/`: notebook, kết quả và tài liệu proof-of-concept; hữu ích để tham khảo nhưng không nên mặc định là luồng production.
- `docker-compose.yml`: chạy frontend và backend; Neo4j được cấu hình kết nối bên ngoài, không có service Neo4j trong file compose này.
- `Neon4j_Summary.md`: tài liệu tổng hợp này.

### Backend

- `backend/score.py`: điểm vào FastAPI và các endpoint HTTP.
- `backend/src/main.py`: các luồng scan nguồn và trích xuất graph từ file, URL, YouTube, Wikipedia, S3/GCS.
- `backend/src/document_sources/`: adapter đọc các loại nguồn khác nhau.
- `backend/src/create_chunks.py`: tách nội dung thành các chunk theo token, giữ metadata trang/thời gian khi có.
- `backend/src/llm.py`, `backend/src/diffbot_transformer.py`, `backend/src/shared/`: chọn LLM, tạo graph document, cấu hình, embedding và hàm dùng chung.
- `backend/src/make_relationships.py`: tạo node/quan hệ chunk, embedding, vector index và liên kết chunk với entity.
- `backend/src/graphDB_dataAccess.py`: thao tác đọc/ghi, trạng thái tài liệu, thống kê, xử lý graph và vector index.
- `backend/src/graph_query.py`, `backend/src/chunkid_entities.py`, `backend/src/neighbours.py`: truy vấn graph, lấy entity/chunk và node lân cận để hiển thị.
- `backend/src/QA_integration.py`: pipeline chat/RAG, lấy ngữ cảnh, gọi LLM và lưu lịch sử chat.
- `backend/src/communities.py`, `backend/src/post_processing.py`: phân cụm/cộng đồng và các bước làm sạch/hậu xử lý graph.
- `backend/src/entities/`: các model/schema request và node dùng bởi backend.
- `backend/src/auth_middleware.py`: middleware kiểm tra bearer token và liên kết danh tính request.
- `backend/test_*.py`, `Performance_test.py`, `locustperf.py`: kiểm thử tích hợp/QA và đo hiệu năng. Cần chạy theo cấu hình/dịch vụ được khai báo trong từng bài test.

### Frontend

- `frontend/src/App.tsx`, `Home.tsx`: khởi tạo ứng dụng và màn hình chính.
- `frontend/src/API/Index.ts`: Axios client, gắn bearer token và thông tin kết nối Neo4j vào request.
- `frontend/src/components/`: giao diện upload/nguồn, bảng file, graph, chat, login, popup và điều hướng.
- `frontend/src/context/`, `hooks/`, `services/`: trạng thái phiên/người dùng, hooks và logic gọi dịch vụ.
- `frontend/src/types.ts`: kiểu dữ liệu TypeScript cho tài liệu, chat, graph và credentials.
- `frontend/public/`, `frontend/src/assets/`: tài nguyên giao diện.

Frontend hiện là client của Knowledge Graph Builder, không phải giao diện quản lý khóa học, điểm số hay tiến độ học tập.

## 3. Luồng hoạt động hiện có

1. Người dùng cung cấp thông tin kết nối Neo4j; cấu hình có thể đến từ form hoặc biến môi trường.
2. Người dùng chọn file hoặc nguồn web/cloud/video và gọi API scan/upload.
3. Backend tạo node `Document` để ghi nhận tên file, nguồn, trạng thái, model, thời điểm và thông tin xử lý.
4. Nội dung được tải về và chia thành node `Chunk`; metadata có thể gồm vị trí, trang, offset hoặc timestamp.
5. LLM/Diffbot trích xuất entity và quan hệ từ các chunk; backend lưu entity, liên kết chunk với entity và hậu xử lý graph.
6. Backend tính embedding cho chunk và tạo vector index nếu cấu hình cho phép. Có thêm chức năng tạo quan hệ `SIMILAR` bằng tìm láng giềng gần nhất.
7. Frontend có thể xem graph, truy vấn chunk/entity, xem node lân cận hoặc đặt câu hỏi. RAG lấy các đoạn liên quan rồi đưa ngữ cảnh cho LLM trả lời, kèm nguồn/chunk khi phù hợp.

Các nhóm endpoint chính trong `backend/score.py` gồm scan/extract/upload, liệt kê và xóa nguồn, chat/lịch sử chat, truy vấn graph/chunk/neighbour, kết nối/schema, quản lý node trùng/lẻ, retry/cancel, vector index, cấu hình embedding và metric. Chúng phục vụ graph tài liệu; chưa có endpoint LMS như ghi danh khóa học, nhập điểm, cập nhật tiến độ hoặc trả gợi ý học tập.

## 4. Mô hình dữ liệu Neo4j hiện có

Schema được tạo theo dữ liệu và cấu hình trích xuất; các thành phần nổi bật quan sát được trong code:

| Thành phần | Ý nghĩa hiện tại |
|---|---|
| `Document` | Nguồn/file đã scan hoặc xử lý; có trạng thái, tên, URL, model, số chunk và thống kê xử lý. |
| `Chunk` | Đoạn văn bản của tài liệu; có text, id, vị trí, độ dài, page/timestamp và embedding. |
| `__Entity__` và label entity | Thực thể được trích xuất từ nội dung; label cụ thể phụ thuộc schema/model. |
| `__Community__` | Cộng đồng/phân cụm entity phục vụ truy vấn ở mức tổng quát. |
| `PART_OF` | Chunk thuộc một tài liệu. |
| `FIRST_CHUNK`, `NEXT_CHUNK` | Điểm bắt đầu và thứ tự chunk trong tài liệu. |
| `HAS_ENTITY` | Chunk nhắc đến hoặc chứa entity được trích xuất. |
| `SIMILAR` | Hai chunk tương tự về embedding; có thể mang điểm số tương đồng. |
| `IN_COMMUNITY`, `PARENT_COMMUNITY` | Liên kết entity/cộng đồng và cấu trúc cộng đồng cha-con. |

Ứng dụng có vector index tên `vector` trên `Chunk.embedding`; embedding model/provider có thể được cấu hình. Chức năng chat hỗ trợ các chế độ như vector, graph, full-text, kết hợp graph/vector/full-text và global/entity vector (tên chế độ chính xác phụ thuộc cấu hình frontend/backend).

## 5. Công nghệ và vận hành

- Python 3.12+ theo README backend; FastAPI/Uvicorn xử lý API.
- React, TypeScript, Vite và Yarn ở frontend.
- Neo4j 5.23+ và APOC theo README gốc; một số truy vấn dùng cú pháp subquery yêu cầu phiên bản này.
- LangChain/LangChain Neo4j, Neo4j Python driver, nhiều connector LLM/embedding; danh sách package được ghim trong `backend/requirements.txt`.
- Có tích hợp nguồn local, web, YouTube, Wikipedia, S3, GCS; các nguồn/model thực sự bật tùy cấu hình môi trường.
- Có lựa chọn chạy backend/frontend riêng, Docker Compose hoặc triển khai cloud. Docker Compose hiện chỉ định nghĩa backend và frontend.
- README ghi nhận theo dõi token và lưu lựa chọn embedding theo hồ sơ trong cấu hình có bật usage tracking.

## 6. Nhận định kỹ thuật và giới hạn cần tính đến

1. **Schema hiện tại hướng tài liệu.** `Document`/`Chunk`/entity không biểu diễn đầy đủ sinh viên, khóa học, lần làm quiz, điểm theo kỳ hay tiến độ.
2. **Định danh tài liệu chưa phải định danh học tập.** Không nên dùng `fileName` làm khóa cho Student/Course; LMS cần ID ổn định từ hệ thống nguồn và ràng buộc uniqueness.
3. **Tìm kiếm ngữ nghĩa không thay thế logic học tập.** Vector similarity giúp tìm nội dung/khóa học liên quan; prerequisite, điều kiện tiên quyết, điểm, thời gian và chính sách đăng ký cần truy vấn/logic rõ ràng.
4. **Tách phạm vi dữ liệu.** Những truy vấn graph tổng quát hoặc truy vấn LLM theo graph cần lọc tenant, tổ chức, khóa học và quyền người dùng. Không đưa dữ liệu cá nhân của sinh viên vào pipeline chat tài liệu dùng chung nếu chưa có kiểm soát truy cập.
5. **Dữ liệu nhạy cảm.** GPA, kết quả quiz, sở thích và khó khăn học tập có thể là dữ liệu cá nhân nhạy cảm. Cần giới hạn mục đích sử dụng, quyền truy cập, thời hạn lưu, audit và khả năng sửa/xóa.
6. **Gợi ý cần giải thích và kiểm soát.** Không nên tự động chặn đăng ký hoặc gán nhãn năng lực chỉ dựa trên điểm số hay một lần quiz. Gợi ý phải cho biết lý do, độ tin cậy và cho phép người học/giảng viên phản hồi.
7. **Tính nhất quán dữ liệu.** Điểm, GPA và enrollment nên lấy từ LMS/SIS là nguồn chuẩn; graph nên là lớp liên kết/phân tích, không trở thành nguồn ghi điểm chính nếu chưa thiết kế quy trình đồng bộ và đối soát.
8. **Khả năng mở rộng.** Cần batch import, cập nhật tăng dần, xử lý sự kiện, idempotency, index/constraint và phân trang. Tránh nạp mọi lượt click thành graph event vô thời hạn.
9. **Lưu ý triển khai:** Credentials Neo4j và token phải được giữ ở backend/secret store, không ghi log hoặc đặt trong graph học tập. Cần kiểm tra chính sách backup, phân quyền database và môi trường test riêng.

## 7. Đề xuất áp dụng Neo4j vào LMS

### 7.1. Mục tiêu

Tạo một **knowledge graph học tập** kết hợp ba góc nhìn:

- **Nội dung:** môn học, module/bài học, learning outcome, chủ đề/kỹ năng, tài liệu, quiz.
- **Lộ trình:** prerequisite, thứ tự học, môn tương đương, độ khó, thời lượng và kỳ mở lớp.
- **Người học:** chương trình/ngành, đăng ký, kết quả, tiến độ, sở thích và năng lực đã được chứng minh.

Neo4j phù hợp khi cần kết nối nhiều loại đối tượng và giải thích đường đi từ hồ sơ người học đến nội dung được đề xuất. Hệ thống relational/LMS hiện hữu vẫn nên giữ vai trò nguồn chuẩn cho enrollment, điểm và thông tin hành chính; đồng bộ sang graph qua API hoặc event/batch.

### 7.2. Schema graph khởi đầu

Các label dưới đây là **schema đề xuất**, không phải node đã tồn tại trong repository.

```text
(:Student {studentId, tenantId, programId, cohort, status})
(:AcademicTerm {termId, startDate, endDate})
(:Enrollment {enrollmentId, status, enrolledAt})
(:Course {courseId, code, title, credits, level, language})
(:Module {moduleId, title, sequence})
(:Lesson {lessonId, title, sequence, estimatedMinutes})
(:LearningOutcome {outcomeId, description})
(:Topic {topicId, name})
(:Skill {skillId, name})
(:LearningResource {resourceId, type, title, url, language})
(:Quiz {quizId, title, maxScore})
(:QuizAttempt {attemptId, attemptedAt, score, maxScore, status})
(:QuizResponse {questionId, isCorrect, score, answeredAt})
(:Interest {topicId, strength, source, updatedAt})
(:Recommendation {recommendationId, score, reason, createdAt, expiresAt})
```

Các quan hệ chính:

```text
(Student)-[:HAS_ENROLLMENT]->(Enrollment)-[:FOR_COURSE]->(Course)
(Enrollment)-[:IN_TERM]->(AcademicTerm)
(Course)-[:HAS_MODULE]->(Module)-[:HAS_LESSON]->(Lesson)
(Course)-[:REQUIRES]->(Course)                    // môn tiên quyết
(Course|Lesson)-[:COVERS]->(Topic|Skill|LearningOutcome)
(Lesson)-[:HAS_RESOURCE]->(LearningResource)
(Lesson)-[:HAS_QUIZ]->(Quiz)
(Student)-[:ATTEMPTED]->(QuizAttempt)-[:FOR_QUIZ]->(Quiz)
(QuizAttempt)-[:HAS_RESPONSE]->(QuizResponse)-[:ASSESSES]->(Skill|LearningOutcome)
(Student)-[:HAS_INTEREST]->(Interest)-[:ABOUT]->(Topic|Skill)
(Student)-[:DEMONSTRATED]->(Skill)                 // chỉ khi có bằng chứng/độ tin cậy
(Student)-[:RECEIVED]->(Recommendation)-[:RECOMMENDS]->(Course|Lesson|LearningResource)
```

**Các lựa chọn modeling quan trọng:**

- Dùng `QuizAttempt` làm node riêng thay vì chỉ đặt `score` trên quan hệ Student-Quiz để giữ được nhiều lần làm, thời điểm, trạng thái và đối soát.
- Lưu `score`/`maxScore` của attempt và `isCorrect`/điểm của response; không ghi đè lịch sử. Khi cần kết quả mới nhất, lấy attempt hợp lệ gần nhất theo chính sách môn học.
- Không xem GPA là thuộc tính bất biến của `Student`: GPA thay đổi theo kỳ và cần truy nguyên nguồn. Có thể lưu `gpa` cùng `AcademicTerm`/bản ghi snapshot, kèm `calculatedAt`, `source` và định nghĩa GPA.
- Sở thích nên có nguồn (`explicit`, hoạt động học tập, cố vấn), thời điểm cập nhật và mức tin cậy. Không tự kết luận sở thích hoặc khuyết tật từ dữ liệu nhạy cảm.
- Tiến độ có thể đặt trên `Enrollment` hoặc một node `Progress` nếu cần lịch sử theo thời điểm; tránh nhiều giá trị tiến độ xung đột trên node Course dùng chung.
- Nếu lưu mỗi câu trả lời, đánh giá quy mô và chính sách retention; nếu chỉ cần phân tích tổng hợp, có thể chỉ đồng bộ mastery/attempt summary đã được chuẩn hóa.

### 7.3. Dữ liệu gợi ý cần dùng

| Nhóm dữ liệu | Ví dụ | Cách sử dụng | Lưu ý |
|---|---|---|---|
| GPA và lịch sử điểm | GPA tổng/kỳ, điểm môn, số tín chỉ | Lọc khóa học theo điều kiện, điều chỉnh độ khó/lộ trình | Xác định thang điểm, kỳ, môn rút/học lại; không dùng GPA làm tiêu chí duy nhất. |
| Môn đã học/đang học | Course, trạng thái, kỳ, kết quả | Loại môn đã hoàn tất; tính prerequisite; tìm môn tiếp theo | Phân biệt đã học, đã đạt, đang học, rút và tương đương. |
| Sở thích | Topic/Skill do người học chọn | Ưu tiên nội dung liên quan | Ưu tiên khai báo trực tiếp và cho phép cập nhật/rút lại. |
| Sở trường/năng lực | Skill đã chứng minh, portfolio, đánh giá | Chọn mức thử thách phù hợp hoặc gợi ý học nâng cao | Kèm bằng chứng, thời điểm, confidence; phân biệt tự đánh giá và đánh giá chính thức. |
| Quiz/assessment | Attempt, response theo outcome/skill | Nhận biết chủ đề vững/yếu và gợi ý ôn tập | Chú ý quiz retake, độ khó, câu hỏi lỗi và sample size; không suy rộng từ ít câu. |
| Nội dung học | Course, lesson, outcome, topic, resource, vector | Kết nối lỗ hổng kiến thức với tài liệu/lesson cụ thể | Nội dung cần metadata, ngôn ngữ và trạng thái còn hiệu lực. |
| Ngữ cảnh học vụ | Chương trình, kỳ, lịch mở lớp, tín chỉ, prerequisite | Đảm bảo đề xuất có thể đăng ký và phù hợp tiến độ | Lấy điều kiện chính thức từ SIS/LMS và cập nhật đúng hạn. |
| Phản hồi gợi ý | xem, lưu, bỏ qua, hoàn thành, hữu ích/không hữu ích | Đo chất lượng và cá nhân hóa dần | Thu thập tối thiểu cần thiết; cho người học quyền kiểm soát. |

### 7.4. Luồng gợi ý đề xuất

1. **Đồng bộ và chuẩn hóa:** nhận Student/Course/Enrollment/Grade/Quiz từ LMS/SIS; map ID nguồn ổn định; kiểm tra tenant và thời gian hiệu lực.
2. **Cập nhật graph:** dùng `MERGE` theo khóa duy nhất, ghi timestamp/source/version, xử lý sự kiện lặp idempotently; giữ điểm gốc có lịch sử thay đổi phù hợp chính sách.
3. **Xây hồ sơ học tập có kiểm soát:** tính tiến độ, prerequisite đã hoàn thành, mastery theo outcome/skill và sở thích do người học cung cấp.
4. **Sinh ứng viên:** đi từ skill/topic yếu hoặc mục tiêu của người học đến lesson/resource/course; dùng prerequisite và điều kiện đăng ký để lọc. Vector similarity có thể tìm tài nguyên liên quan khi nội dung đã có embedding.
5. **Xếp hạng:** kết hợp độ liên quan mục tiêu/sở thích, khoảng trống kỹ năng, tính sẵn sàng, điều kiện tiên quyết, thời lượng/ngôn ngữ, mức độ khó phù hợp và phản hồi trước đó.
6. **Trả lời có giải thích:** trả đề xuất cùng các lý do cụ thể, bằng chứng được phép dùng, score/confidence và lựa chọn bỏ qua/đánh dấu hoàn thành.
7. **Đo lường:** theo dõi tỷ lệ xem/lưu/hoàn thành, hữu ích do người học đánh giá, mức cải thiện theo outcome và chênh lệch giữa nhóm; kiểm tra bias trước khi cập nhật trọng số.

Ví dụ công thức khởi đầu để xếp hạng, cần hiệu chỉnh bằng dữ liệu và đánh giá thực tế:

```text
score(student, item) =
		w_goal       * goal_relevance
	+ w_interest   * declared_interest_match
	+ w_gap        * supported_learning_gap
	+ w_readiness  * prerequisite_readiness
	+ w_feedback   * prior_positive_feedback
	- w_duplicate  * already_completed_or_redundant
	- w_mismatch   * level_or_schedule_mismatch
```

Mỗi thành phần nên chuẩn hóa về cùng miền giá trị, có trọng số cấu hình được, có phiên bản và có thể giải thích. `supported_learning_gap` cần dựa trên nhiều câu hỏi/attempt hợp lệ hoặc đánh giá đủ tin cậy, không phải một đáp án sai đơn lẻ. GPA nên chủ yếu là tín hiệu ngữ cảnh/điều kiện học vụ được cho phép, không phải proxy duy nhất cho khả năng hoặc tiềm năng.

### 7.5. Ví dụ truy vấn Cypher minh họa

Ví dụ sau giả định schema đề xuất đã được tạo, lọc prerequisite hoàn thành và tạo lý do dễ giải thích. Đây chưa phải truy vấn chạy được trên graph hiện tại; cần điều chỉnh theo chính sách GPA, retake, enrollment và tenant của LMS.

```cypher
MATCH (s:Student {studentId: $studentId, tenantId: $tenantId})
MATCH (s)-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(completed:Course)
MATCH (completed)-[:COVERS]->(skill:Skill)
WHERE skill.skillId IN $skillsToPractice
MATCH (lesson:Lesson)-[:COVERS]->(skill)
MATCH (course:Course)-[:HAS_MODULE]->(:Module)-[:HAS_LESSON]->(lesson)
WHERE NOT EXISTS {
	MATCH (s)-[:HAS_ENROLLMENT]->(:Enrollment)-[:FOR_COURSE]->(course)
}
	AND NOT EXISTS {
		MATCH (course)-[:REQUIRES]->(prerequisite:Course)
		WHERE NOT EXISTS {
			MATCH (s)-[:HAS_ENROLLMENT]->(enrollment:Enrollment)-[:FOR_COURSE]->(prerequisite)
			WHERE enrollment.status = 'completed'
		}
	}
RETURN DISTINCT course.courseId AS courseId,
			 course.title AS title,
			 collect(DISTINCT skill.name) AS relatedSkills,
			 'Practice skill(s) with prior learning context' AS reason
ORDER BY title
LIMIT $limit
```

Trong production, cần kiểm tra kỹ điều kiện lấy prerequisite: người học có thể có course equivalency, waiver, đang học prerequisite, hoặc ngoại lệ được advisor duyệt. Không nên biến ví dụ này thành quy tắc học vụ mặc định.

### 7.6. Tích hợp với repository hiện tại

- Tạo module/dịch vụ LMS riêng (ví dụ `backend/src/lms/` hoặc package tương đương) với schema, repository/query và API riêng; không nhồi logic Student/Course vào luồng trích xuất `Document`/`Chunk`.
- Bổ sung endpoint có xác thực cho đồng bộ hồ sơ, enrollment, kết quả assessment, truy vấn lộ trình và ghi nhận phản hồi gợi ý.
- Tái sử dụng `get_graphDB_driver`/cấu hình kết nối ở mức phù hợp, nhưng tách query và quyền database theo tenant/role. Đặc biệt, không nhận `studentId` từ client mà không xác minh caller được phép xem hồ sơ đó.
- Tái sử dụng embedding/vector index cho tìm kiếm semantic trên mô tả course, outcome và learning resource. Có thể dùng label/index riêng như `LearningResource.embedding` hoặc index riêng để tránh trộn với `Chunk.embedding` và cấu hình embedding hiện tại.
- Có thể tái sử dụng chat/RAG để hỏi đáp về tài liệu môn học, nhưng retrieval phải lọc course/enrollment/ACL trước khi gửi nội dung cho LLM. LLM không nên tự quyết định điểm, điều kiện đăng ký hoặc chẩn đoán năng lực.
- Frontend cần trải nghiệm LMS riêng: mục tiêu học, tiến độ, danh sách gợi ý, giải thích và quyền phản hồi; tránh phụ thuộc vào màn hình quản trị tài liệu hiện có.
- Giữ hệ thống LMS/SIS làm nguồn chuẩn, còn Neo4j là lớp liên kết và truy vấn gợi ý. Bắt đầu bằng đồng bộ một chiều và reconciliation trước khi cân nhắc ghi ngược dữ liệu.

### 7.7. Ràng buộc, index và vận hành cần bổ sung

- Unique constraints cho các ID nguồn như `Student.studentId + tenantId`, `Course.courseId + tenantId`, `Quiz.quizId + tenantId`, `Enrollment.enrollmentId`.
- Index cho `tenantId`, `studentId`, `courseId`, `termId`, trạng thái enrollment, thời gian attempt và các thuộc tính thường lọc.
- Vector index chỉ khi có use case retrieval semantic rõ ràng; ghi nhận embedding model/version/dimension và kế hoạch rebuild khi đổi model.
- Định nghĩa retention/aggregation cho QuizResponse và Recommendation; không dùng profile gợi ý để lưu dữ liệu không cần thiết.
- Có API audit và logging không chứa password, token, câu trả lời nhạy cảm hoặc dữ liệu định danh quá mức.
- Kiểm thử quyền truy cập chéo tenant/student, đồng bộ lặp, update/xóa, course prerequisite, retake, GPA theo kỳ, cold start và trường hợp thiếu dữ liệu.

## 8. Lộ trình MVP khuyến nghị

### Giai đoạn 1: dữ liệu và quy tắc

- Chốt nguồn chuẩn, ID, định nghĩa GPA/điểm, trạng thái enrollment, prerequisite và quyền sử dụng dữ liệu.
- Chọn một chương trình hoặc một nhóm khóa học thử nghiệm; chuẩn hóa course, lesson, learning outcome, skill/topic và quiz mapping.
- Chốt nguyên tắc consent, retention, audit và ai được xem hồ sơ nào.

### Giai đoạn 2: graph và đồng bộ

- Tạo uniqueness constraints/index và job/API import idempotent.
- Nạp Student, Course, Enrollment, Term, QuizAttempt và mapping assessment-to-skill tối thiểu.
- Đối soát số bản ghi và kết quả với LMS/SIS; xây quy trình sửa/xóa đồng bộ.

### Giai đoạn 3: gợi ý có thể giải thích

- Bắt đầu bằng rule-based/hybrid ranking (prerequisite + skill gap + sở thích khai báo + điều kiện đăng ký), chưa cần mô hình ML.
- Hiển thị gợi ý kèm lý do và nguồn dữ liệu; có nút hữu ích/không phù hợp, ẩn và hoàn thành.
- So sánh với baseline đơn giản và đánh giá cùng giảng viên/người học trước khi mở rộng.

### Giai đoạn 4: đo lường và mở rộng

- Đánh giá chất lượng, coverage/cold-start, fairness, mức cải thiện learning outcome, privacy và độ trễ.
- Chỉ cân nhắc ranking ML sau khi đủ dữ liệu hợp lệ, có nhãn/đánh giá và quy trình giám sát.
- Mở rộng sang nhiều tenant/chương trình, xử lý cập nhật gần thời gian thực và nội dung semantic khi vận hành ổn định.

## 9. Chỉ số đánh giá gợi ý

- **Chất lượng đề xuất:** precision@k/recall@k hoặc nDCG@k trên bộ đánh giá có kiểm duyệt; tách offline và thử nghiệm có giám sát.
- **Tính hữu ích:** lượt lưu, bắt đầu, hoàn thành và đánh giá hữu ích; không xem click đơn thuần là thành công học tập.
- **Kết quả học tập:** tiến bộ theo learning outcome/skill qua đánh giá tương đương; kiểm soát khác biệt nền và không suy luận quan hệ nhân quả chỉ từ correlation.
- **Tính hợp lệ:** tỷ lệ đề xuất vượt prerequisite, đúng kỳ/lịch, còn mở và truy cập được.
- **Công bằng và an toàn:** coverage theo nhóm, tỷ lệ lỗi/đề xuất bất lợi, khả năng giải thích và xử lý khiếu nại; dùng nhóm bảo vệ chỉ khi có căn cứ pháp lý/đạo đức và kiểm soát phù hợp.
- **Vận hành:** độ trễ p95, độ mới dữ liệu, lỗi đồng bộ, tỷ lệ ID không map và chi phí Neo4j/embedding/LLM.

## 10. Kết luận

Repository hiện là một **Knowledge Graph Builder cho dữ liệu phi cấu trúc có RAG**, với Neo4j làm graph store. Nền tảng có thể hỗ trợ một hệ thống LMS thông minh, đặc biệt ở phần nối kiến thức môn học, kết quả học tập, prerequisite và tài nguyên để tạo lộ trình cá nhân hóa có giải thích. Nhưng cần phát triển một bounded domain LMS riêng, bổ sung schema/API/identity/authorization/integration và quy trình quản trị dữ liệu học tập; không có sẵn chỉ bằng cách bật tính năng hiện tại.

Hướng khởi đầu ít rủi ro là graph hóa catalog khóa học và learning outcomes trước, đồng bộ enrollment/quiz summary tối thiểu, sau đó đưa ra gợi ý theo luật có giải thích. Chỉ mở rộng sang ranking ML hoặc dùng dữ liệu chi tiết từng câu trả lời sau khi đã chứng minh nhu cầu, chất lượng dữ liệu, quyền sử dụng và hiệu quả với người học.

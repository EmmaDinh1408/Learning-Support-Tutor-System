# G4LMS Frontend

React 18 + TypeScript + Vite.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

Đăng nhập demo: chọn tab **Học viên** hoặc **Giảng viên**, bấm đăng nhập (không cần nhập gì).

## Cấu trúc

```
frontend/
├─ index.html
├─ package.json
└─ src/
   ├─ main.tsx · App.tsx          # router + guard theo vai trò
   ├─ types/                      # kiểu dữ liệu dùng chung
   ├─ api/                        # client.ts (thay phần thân bằng fetch khi có backend) + mockData.ts
   ├─ pages/                      # Login, Student/Teacher Courses, Student/Teacher Course Graph, Teacher Node Editor
   ├─ features/
   │  ├─ auth · layout · common   # AuthContext, AppHeader, ProgressBar, useAsync
   │  ├─ courses                  # thẻ khoá học + thanh lọc
   │  ├─ graph                    # GraphCanvas (SVG pan/zoom), node học viên, panel LO/chi tiết
   │  └─ teacher                  # modal chọn PDF, tiến trình tạo graph, hàng đợi, inspector, heatmap, LO view
   └─ styles/global.css
```

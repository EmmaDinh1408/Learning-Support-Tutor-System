import type { Quiz, QuizOption } from '../frontend/src/types';

export interface QuizFixture {
  quiz: Quiz;
  answerKey: Record<string, string>;
}

function createQuiz(id: string, courseId: string, title: string, prompt: string, answer: string, options: QuizOption[]): QuizFixture {
  const qId = `${id}-q1`;
  return {
    quiz: {
      id,
      courseId,
      title,
      description: 'Bài kiểm tra nhanh để củng cố kiến thức trong chương.',
      timeLimitMinutes: 10,
      attemptsAllowed: 2,
      attemptsUsed: 0,
      status: 'published',
      questions: [{
        id: qId,
        prompt,
        options,
      }],
    },
    answerKey: { [qId]: answer },
  };
}

export const quizFixtures: QuizFixture[] = [
  createQuiz('net-ch1-quiz', 'CO3093', 'Quiz: Tổng quan mạng máy tính', 'Giao thức nào chịu trách nhiệm phân giải tên miền?', 'b', [
    { id: 'a', text: 'HTTP' }, { id: 'b', text: 'DNS' }, { id: 'c', text: 'FTP' }, { id: 'd', text: 'SMTP' },
  ]),
  createQuiz('net-app-quiz', 'CO3093', 'Quiz: Tầng ứng dụng', 'HTTP thường được sử dụng để truyền loại dữ liệu nào?', 'a', [
    { id: 'a', text: 'Tài nguyên web' }, { id: 'b', text: 'Bảng định tuyến' }, { id: 'c', text: 'Khung Ethernet' }, { id: 'd', text: 'Gói IP' },
  ]),
  createQuiz('net-tcp-quiz', 'CO3093', 'Quiz: TCP và UDP', 'Đặc tính nào phân biệt TCP với UDP?', 'c', [
    { id: 'a', text: 'TCP không có số thứ tự' }, { id: 'b', text: 'UDP đảm bảo truyền tin cậy' }, { id: 'c', text: 'TCP thiết lập kết nối và truyền tin cậy' }, { id: 'd', text: 'UDP luôn mã hóa dữ liệu' },
  ]),
  createQuiz('net-routing-quiz', 'CO3093', 'Quiz: Định tuyến mạng', 'Bảng định tuyến được dùng để làm gì?', 'd', [
    { id: 'a', text: 'Lưu mật khẩu người dùng' }, { id: 'b', text: 'Đếm số byte ứng dụng' }, { id: 'c', text: 'Mã hóa khung dữ liệu' }, { id: 'd', text: 'Chọn đường chuyển tiếp gói tin' },
  ]),
  createQuiz('net-security-quiz', 'CO3093', 'Quiz: An toàn mạng', 'HTTPS bảo vệ dữ liệu truyền bằng cách nào?', 'b', [
    { id: 'a', text: 'Nén nội dung HTTP' }, { id: 'b', text: 'Dùng TLS để mã hóa và xác thực' }, { id: 'c', text: 'Ẩn địa chỉ IP' }, { id: 'd', text: 'Đổi DNS mỗi yêu cầu' },
  ]),
  createQuiz('quiz-co3029', 'CO3029', 'Bài kiểm tra trắc nghiệm', 'Mục tiêu chính của phân cụm dữ liệu là gì?', 'a', [
    { id: 'a', text: 'Nhóm các điểm dữ liệu tương tự' }, { id: 'b', text: 'Gán nhãn đúng cho mọi điểm' }, { id: 'c', text: 'Mã hóa dữ liệu' }, { id: 'd', text: 'Tăng số chiều dữ liệu' },
  ]),
];

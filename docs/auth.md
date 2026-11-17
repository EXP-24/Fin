# Khách và tài khoản

Mọi người truy cập đều được cấp một danh tính **khách** tự động (cookie HttpOnly `finai_guest`),
nên dùng được ngay không cần đăng nhập. Khách có thể **đăng ký** để lưu lịch sử trò chuyện:

- **Khách không lưu lịch sử trò chuyện**: tin nhắn của khách không được ghi vào PostgreSQL và
  `GET /api/sessions/{id}/chat` trả về danh sách rỗng. Tải lại trang là mất nội dung chat. Tài liệu
  đã tải lên vẫn thuộc phiên. Redis chỉ giữ một cửa sổ ngắn (hết hạn sau `FINSIGHT_MEMORY_TTL`)
  để các câu hỏi nối tiếp trong cùng lượt dùng vẫn mạch lạc.
- **Đăng ký từ khách**: nâng cấp chính danh tính khách đó thành tài khoản (`status = member`);
  các phiên (và tài liệu) đã tạo vẫn thuộc về tài khoản mới, nhưng chat trước khi đăng ký không được lưu.
  Từ lúc đăng ký, tin nhắn mới được lưu.
- **Đăng nhập**: chuyển sang tài khoản đã có. Hội thoại của danh tính khách trước đó không được gộp.
- **Đăng xuất**: hủy token hiện tại; trình duyệt quay lại một khách mới.

Trang đăng nhập/đăng ký: http://localhost:5173/login (nút đăng nhập ở thanh trên và menu tài khoản).

- Tên đăng nhập 3–64 ký tự: chữ không dấu, số, `.`, `_`, `-`; chuẩn hóa về chữ thường.
- Mật khẩu 8–128 ký tự, băm scrypt (N=2^17, r=8, p=1) với salt ngẫu nhiên.
- Tối đa 10 lần đăng ký/đăng nhập mỗi phút cho mỗi địa chỉ.

## Dữ liệu trong PostgreSQL

| Bảng | Nội dung |
| --- | --- |
| `users` | ID, `status` (`guest`/`member`), `username` và `password_hash` (chỉ với member) |
| `auth_sessions` | Hash của token, người dùng, thời hạn (90 ngày) |
| `sessions.owner_user_id` | Chủ sở hữu hội thoại; tài liệu và chat thuộc hội thoại đó |

Backend tự thêm cột/bảng khi khởi động. Hội thoại có trước tính năng này giữ `owner_user_id = NULL`
và không thuộc về ai.

## API

| Method | Đường dẫn | Chức năng |
| --- | --- | --- |
| POST | `/api/auth/guest` | Trả danh tính hiện tại (tạo khách nếu chưa có), kèm `csrf_token` |
| POST | `/api/auth/register` | Đăng ký (nâng cấp khách hiện tại) |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/logout` | Hủy phiên hiện tại |

Các yêu cầu thay đổi dữ liệu cần header `X-FinAI-CSRF` (frontend tự gắn).

## Triển khai

Dùng HTTPS và đặt `FINAI_COOKIE_SECURE=true`. Không dùng wildcard trong `FINSIGHT_CORS_ORIGINS`.

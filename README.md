# Bingo18 LAB 9.0 - Render Free

Bản triển khai HTTPS miễn phí, kế thừa ứng dụng Bingo18 LAB 8.1. Nguồn từ Xổ Số Minh Ngọc là bên thứ ba, KHÔNG phải nguồn chính thức Vietlott. Chưa xác thực được việc lấy dữ liệu thực tế khi chạy từ Render; trang nguồn có thể đổi HTML/chặn máy chủ. Không có lịch sử giả.

## Cách đưa lên Render miễn phí

1. Tạo tài khoản tại https://github.com và một repository (ví dụ `bingo18-lab`).
2. Tải lên **các file nằm ngay trong thư mục này** vào gốc repository: `index.html`, `server.py`, `requirements.txt`, `render.yaml`, `.gitignore`, `README.md`.
3. Đăng nhập https://dashboard.render.com, kết nối GitHub.
4. Chọn **New > Blueprint** và chọn repository vừa tạo (file `render.yaml` sẽ tự khai báo dịch vụ Free). Nếu không dùng Blueprint, chọn New > Web Service, Runtime Python, Build `pip install -r requirements.txt`, Start `python server.py`, Instance Type **Free**.
5. Chờ trạng thái **Live**, mở URL dạng `https://bingo18-lab-free-xxxx.onrender.com` trên Safari. Không mở file `index.html` trực tiếp nữa.
6. Mở `https://<domain>/healthz` để kiểm tra máy chủ. Mở `https://<domain>/api/results` để xem `status`, `error`, `rows` và `fetched_at`. Nếu status `unavailable`, đó là lỗi đọc nguồn (không phải lỗi hosting) và cần sửa parser hoặc thay nguồn được phép truy cập.
7. Safari > Chia sẻ > Thêm vào Màn hình chính để mở như app.

## Giới hạn

- Render Free ngủ sau 15 phút không hoạt động, có thể cần khoảng 1 phút để khởi động lại.
- Bộ đệm lịch sử trong RAM bị mất khi server ngủ/khởi động lại; trang nguồn có thể bị chặn và API trả `unavailable`.
- Máy chủ chỉ kiểm tra nguồn khi có truy cập API và cách nhau ít nhất 90 giây. Không phải cơ chế theo dõi 24/7 hoặc cập nhật ngay sau mỗi kỳ.
- Không lưu/đặt cược; chỉ phục vụ thống kê độc lập.

## Chạy cục bộ

`python -m pip install -r requirements.txt`

`python server.py`

Mở http://127.0.0.1:8765 và http://127.0.0.1:8765/healthz.

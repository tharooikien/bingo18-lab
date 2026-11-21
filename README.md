# Bingo18 LAB 11.3

Ứng dụng web tiếng Việt để lưu lịch sử Bingo18 và phân tích kết quả xổ số miền Trung (XSMT) theo đài. Phiên bản 11.3 là phiên bản trong mã nguồn. Để xác định bản đang chạy trên Render, đối chiếu commit của lần triển khai thành công với mã nguồn trên GitHub.

## Chức năng

- **Bingo18.** Đồng bộ kết quả, xem kho lịch sử và thống kê, khóa gợi ý khi đủ điều kiện và đối chiếu với kết quả. Kho riêng của người dùng nằm trong IndexedDB của trình duyệt. Dùng JSON để sao lưu và khôi phục cả lịch sử lẫn gợi ý đã khóa. Có thể xuất Excel (.xlsx), xuất từng bảng ra CSV hoặc nhập CSV lịch sử.
- **Xổ số miền Trung.** Chọn một trong 14 đài và giới hạn 7, 14, 30 hoặc tất cả kỳ đã đọc. Giao diện hiển thị số kỳ thực có, giải Tám, giải Đặc biệt và tối đa 10 cặp hai số cuối giải Đặc biệt xuất hiện nhiều nhất trong mẫu. Kết quả giữ số 0 đầu, chẳng hạn `03`.
- **Thống kê chữ số.** Bốn bảng đếm riêng hàng chục và hàng đơn vị của giải Tám và hai số cuối giải Đặc biệt. Khi có dữ liệu, mỗi bảng hiển thị đủ các chữ số 0–9. Với chữ số xuất hiện `c` lần trong `n` kỳ, tỷ lệ tham khảo là `(c + 5) / (n + 50)`. Đây là ước lượng làm mượt từ mẫu lịch sử. Mốc 10% cho một chữ số ở một vị trí và 1% cho một cặp dựa trên giả định 100 cặp đồng khả năng. Xếp hạng lịch sử chưa được kiểm định để dự báo kỳ sau.

## Triển khai trên Render Free

1. Kết nối Render với repository `tharooikien/bingo18-lab`, chọn nhánh `main` và dùng toàn bộ repository làm thư mục gốc. Máy chủ Python phục vụ cả giao diện và API.
2. Khi tạo dịch vụ mới, chọn **New → Blueprint** và dùng [render.yaml](render.yaml). Nếu tạo thủ công, chọn **Web Service** và nhập các giá trị bên dưới. Nếu đã có dịch vụ, triển khai commit mong muốn trên dịch vụ hiện có để giữ nguyên địa chỉ ứng dụng.
3. Chờ lần triển khai thành công, mở URL HTTPS do Render cấp rồi kiểm tra hai đường dẫn ở mục sau. Dịch vụ Free có thể cần thời gian khởi động lại sau khi ngủ.

| Thiết lập | Giá trị trong repository |
| --- | --- |
| Tên dịch vụ / gói | `bingo18-lab-free` / `free` |
| Runtime / biến môi trường | Python / `PYTHON_VERSION=3.12.7` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `python server.py` |
| Health Check Path | `/healthz` |

## Kiểm tra máy chủ và dữ liệu

Mở các đường dẫn trên cùng tên miền với ứng dụng, hoặc chạy hai lệnh sau sau khi thay tên miền mẫu bằng tên miền thực tế.

```sh
BASE_URL='https://ten-dich-vu.onrender.com'
curl -i "$BASE_URL/healthz"
curl -sS "$BASE_URL/api/xsmt"
```

- **GET /healthz** trả HTTP 200 và `{"ok":true}` khi máy chủ xử lý được yêu cầu. Phản hồi này không chứa số phiên bản hay kết quả kiểm tra nguồn xổ số.
- **GET /api/xsmt** trả JSON. Đọc `status` kể cả khi HTTP là 200. So sánh số phần tử của `sources_ok` với `sources_expected` (7 trang theo thứ), xem `error` và thời điểm `fetched_at`. Mỗi dòng trong `rows` có ngày (`date`), mã đài (`province`), giải Tám (`eighth`), giải Đặc biệt sáu chữ số (`special`) và hai số cuối (`tail`).
- **GET /api/results** cung cấp dữ liệu Bingo18 riêng. Trạng thái có thể là `ok`, `stale` (còn kết quả cũ sau lỗi) hoặc `unavailable`.

| Trạng thái XSMT | Cách đọc kết quả |
| --- | --- |
| `ok` | Có dữ liệu và lần kiểm tra nguồn không ghi nhận lỗi. Số kỳ mỗi đài vẫn phụ thuộc các trang đã đọc. |
| `partial` | Có dữ liệu nhưng lần kiểm tra ghi nhận lỗi. Các dòng có thể gồm kết quả giữ từ lần trước. |
| `unavailable` | Chưa có dòng kết quả dùng được. Xem `error` để biết trang hoặc bước đọc gặp lỗi. |

## Dùng trên iPhone và cập nhật giao diện

1. Mở URL **HTTPS** của dịch vụ bằng **Safari**, chọn **Chia sẻ → Thêm vào Màn hình chính → Thêm**. Mở ứng dụng từ biểu tượng mới khi còn mạng.
2. Trong **Hướng dẫn**, chờ thông báo đã lưu giao diện. Sau đó có thể mở lại ứng dụng, xem kho Bingo18 trên thiết bị và xuất dữ liệu khi mất mạng. Đọc kết quả mới và xác nhận khóa gợi ý cần kết nối máy chủ.
3. Sau một lần triển khai mới, mở ứng dụng khi có mạng. Khi nút **Cập nhật ứng dụng** xuất hiện trong **Hướng dẫn**, nhấn để kích hoạt bản đang chờ. Trang đang do service worker cũ quản lý sẽ tải lại khi bản mới tiếp quản.
4. Để kiểm tra kỹ thuật, mở đường dẫn `/sw.js` trên dịch vụ và tìm `bingo18-shell-11.3`. Đây là tên bộ đệm giao diện trong bản 11.3. Khi kích hoạt, service worker xóa các bộ đệm giao diện cũ có tiền tố `bingo18-shell-`. Các phản hồi `/api/*` và `/healthz` đi qua mạng. Sao lưu JSON trong **Kho lịch sử** trước khi đổi thiết bị, đổi tên miền hoặc xóa dữ liệu trang.

## Giới hạn thu thập

Dữ liệu lấy từ các trang kết quả của Xổ Số Minh Ngọc, một nguồn bên thứ ba. Máy chủ đọc dữ liệu theo yêu cầu. Nguồn có thể chặn truy cập, đổi HTML hoặc chưa đăng đủ kết quả. Khi đó cần xem trạng thái API và số kỳ thực có trước khi diễn giải thống kê.

- **Bingo18** giới hạn kiểm tra nguồn cách nhau ít nhất 90 giây trên mỗi tiến trình máy chủ.
- **XSMT** đọc tối đa bảy trang theo thứ trong mỗi lần làm mới, tối đa hai yêu cầu đồng thời. Mỗi tiến trình chờ ít nhất một giờ giữa hai lần bắt đầu làm mới, kể cả khi lần trước gặp lỗi. Nhấn tải lại trong khoảng này chỉ nhận trạng thái hiện có.
- Máy chủ ghép kết quả theo ngày và đài, giữ bản cũ khi gặp kết quả mâu thuẫn và giữ tối đa 1.500 dòng XSMT trong RAM. Khởi động lại có thể làm mất mẫu tích lũy. Chọn “30 kỳ” chỉ giới hạn số kỳ đưa vào thống kê, không bảo đảm có đủ 30 kỳ cho đài đó.

## Chạy cục bộ

Tại thư mục gốc của repository, chạy:

```sh
python -m pip install -r requirements.txt
python server.py
```

Mở `http://localhost:8765`. Có thể kiểm tra hai API trên cùng địa chỉ này và dùng localhost để thử service worker.

Chi tiết phân tích miền Trung nằm trong [XSMT.md](XSMT.md). [DEPLOY11.md](DEPLOY11.md) ghi lại hướng dẫn của bản 11.0.

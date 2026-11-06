# Phân tích xổ số miền Trung (bản phát triển 11.2)

Mục **Xổ số miền Trung** đọc các bảng kết quả theo bảy thứ trong tuần tại
`https://xosominhngoc.net.vn/kqxs-mien-trung/...`. Chỉ lấy giải đặc biệt sáu
chữ số đã công bố và giải tám hai chữ số để kiểm tra bảng đã hoàn tất. Mỗi bản
ghi gắn ngày và mã đài; hai số cuối giữ dưới dạng chuỗi để không mất số 0 đầu.
Trang thống kê của nguồn không được thu thập.

Ứng dụng cho chọn một trong 14 đài, giới hạn 7, 14, 30 hoặc tất cả kỳ đã đọc.
Nó hiển thị tần suất hai số cuối, chữ số hàng chục/hàng đơn vị, các kết quả gần
nhất và số kỳ thực tế trong mẫu. Mô hình lý thuyết *giả sử 100 cặp số đồng
khả năng* cho 1% mỗi cặp ở kỳ tới và 10% mỗi chữ số tại một vị trí. Tần suất
quá khứ không làm tăng cơ hội của cặp số ở lần quay tiếp theo; không dùng bảng
xếp hạng như lời khuyên chọn số.

Máy chủ đọc tối đa bảy trang nguồn mỗi lần làm mới, hai yêu cầu cùng lúc và
không kiểm tra lại trong một giờ. Cache nằm trong bộ nhớ Render Free nên có thể
mất khi máy chủ ngủ/khởi động lại. Nếu chỉ một số trang tải được, API báo
`partial`, giữ dữ liệu cũ không mâu thuẫn và giao diện nêu rõ mẫu thực có.
Không cam kết cập nhật trực tiếp từng phút hay 30 kỳ cho mọi đài.

Kiểm tra: `python -m unittest -v test_xsmt`, `node --check xsmt.js`, chạy
`python server.py` và mở mục Xổ số miền Trung. API mới là `/api/xsmt`.

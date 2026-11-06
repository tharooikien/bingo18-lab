# Phân tích xổ số miền Trung (bản phát triển 11.3)

Mục **Xổ số miền Trung** đọc các bảng kết quả theo bảy thứ trong tuần tại
`https://xosominhngoc.net.vn/kqxs-mien-trung/...`. Lấy giải tám hai chữ số
và giải đặc biệt sáu chữ số đã công bố. Mỗi bản ghi gắn ngày và mã đài; giải
tám và hai số cuối giải đặc biệt giữ dạng chuỗi để không mất số 0 đầu.
Trang thống kê của nguồn không được thu thập.

Ứng dụng cho chọn một trong 14 đài, giới hạn 7, 14, 30 hoặc tất cả kỳ đã đọc.
Nó hiển thị tần suất hai số cuối giải đặc biệt, và bốn bảng xếp hạng chữ số
hàng chục/hàng đơn vị của riêng giải tám và giải đặc biệt. Các bảng hiện đầy đủ
10 chữ số, đếm số kỳ và ước lượng tham khảo `(số lần + 5) / (số kỳ + 50)` cho
mỗi chữ số; đây là làm mượt mẫu nhỏ với năm quan sát giả định trên mỗi chữ số,
không phải xác suất trúng đã được kiểm định. Tổng ước lượng trong mỗi bảng là
100%. Mô hình lý thuyết *giả sử 100 cặp số đồng khả năng* cho 1% mỗi cặp ở kỳ
tới và 10% mỗi chữ số tại một vị trí. Tần suất quá khứ không chứng minh cơ hội
của số đó tăng ở lần quay tiếp theo; không dùng bảng xếp hạng như lời khuyên
chọn số.

Máy chủ đọc tối đa bảy trang nguồn mỗi lần làm mới, hai yêu cầu cùng lúc và
không kiểm tra lại trong một giờ. Cache nằm trong bộ nhớ Render Free nên có thể
mất khi máy chủ ngủ/khởi động lại. Nếu chỉ một số trang tải được, API báo
`partial`, giữ dữ liệu cũ không mâu thuẫn và giao diện nêu rõ mẫu thực có.
Không cam kết cập nhật trực tiếp từng phút hay 30 kỳ cho mọi đài.

Kiểm tra: `python -m unittest -v test_xsmt`, `node --check xsmt.js`, chạy
`python server.py` và mở mục Xổ số miền Trung. API mới là `/api/xsmt`.

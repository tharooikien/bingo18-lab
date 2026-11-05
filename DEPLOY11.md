# Bingo18 LAB 11.0

## Trạng thái
Bản này hoàn tất mã cho xuất/nhập CSV, xuất Excel, giao diện điện thoại và bộ nhớ giao diện PWA. Chưa triển khai lên GitHub/Render trong phiên tạo bản này. Không bao gồm dữ liệu riêng trong trình duyệt.

## Kiểm tra trước cập nhật
1. Mở app hiện tại, vào Kho lịch sử, tải bản sao lưu JSON.
2. Giữ nguyên https://bingo18-lab.onrender.com để kho IndexedDB tiếp tục dùng cùng địa chỉ. Bản 11 không đổi tên hoặc xóa kho của bản 10.
3. Đưa toàn bộ tệp bản 11 vào repository tharooikien/bingo18-lab, giữ nguyên dữ liệu tài khoản và cấu hình Free. Triển khai commit mới qua Render Manual Deploy.
4. Mở lại trang, xác nhận phiên bản 11.0. Sau lần mở online thành công, giao diện được lưu cho lần sau. Khi có nút Cập nhật ứng dụng trong Hướng dẫn, dùng nút đó để nhận bản giao diện mới.

## Chức năng
- Kho lịch sử: xuất Excel .xlsx gồm Lich su, Thong ke, Doi chieu. Mã kỳ là chuỗi để giữ số 0 đầu. Tỷ lệ trong Excel hiển thị dạng phần trăm.
- Xuất CSV từng bảng với UTF-8 BOM và dấu phân cách chấm phẩy. Nhập CSV lịch sử giữ nguyên 8 cột tiêu đề, từ chối dòng sai, bỏ trùng và giữ bản cũ khi mâu thuẫn.
- JSON tiếp tục là định dạng sao lưu toàn bộ kho và gợi ý khóa. CSV không khôi phục gợi ý khóa. Không nhập trực tiếp XLSX.
- Hướng dẫn: cài lên màn hình chính; thông báo trạng thái bộ nhớ và cập nhật.
- Ngoại tuyến: xem kho và xuất CSV/Excel; kết quả mới và khóa gợi ý cần máy chủ. Không lưu phản hồi API hay biên nhận vào bộ nhớ giao diện.

## Hosting miễn phí
Không thay đổi gói, không tạo dịch vụ có phí, không thêm tác vụ gọi giữ máy chủ chạy. Render Free vẫn ngủ sau thời gian không truy cập; lần đầu có thể mất khoảng một phút. Các lần sau PWA mở giao diện đã lưu ngay và giữ kho cũ trong lúc gọi dữ liệu; yêu cầu đồng bộ có thời hạn 65 giây. Nguồn: https://render.com/docs/free

Bộ nhớ giao diện cần HTTPS hoặc localhost và trình duyệt hỗ trợ Service Worker. Bộ nhớ có thể bị trình duyệt thu hồi. Khi đổi địa chỉ hosting hoặc thiết bị cần sao lưu JSON rồi khôi phục. Không chuyển sang Static Site đơn thuần vì app vẫn cần máy chủ Python đọc nguồn và cấp biên nhận.

## Chạy thử cục bộ
python -m pip install -r requirements.txt
python server.py
Mở http://localhost:8765 (dùng localhost để kiểm tra PWA).

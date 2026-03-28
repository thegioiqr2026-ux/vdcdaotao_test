/**
 * VDC CRM - Main Controller
 * Phiên bản: 4.7
 * Tính năng: Sidebar Auto-Collapse & Iframe Navigation
 */

window.loadView = async function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    const sidebar = document.getElementById('layout-sidebar');
    const timestamp = new Date().getTime();

    // 1. ĐIỀU KHIỂN SIDEBAR TỰ ĐỘNG
    // Tự động thu nhỏ sidebar khi làm việc với hồ sơ/in ấn để tăng diện tích hiển thị
    if (viewFile === 'views/loadExcel.html' || viewFile === 'printdoc.html') {
        sidebar.classList.remove('expanded'); 
        console.log("Sidebar collapsed for data view.");
    } else {
        sidebar.classList.add('expanded');
    }

    // 2. HIỂN THỊ TRẠNG THÁI LOADING
    contentDiv.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-blue-500">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl mb-2"></i>
            <span class="text-xs font-medium text-gray-500">Đang nạp dữ liệu...</span>
        </div>`;

    // 3. ĐIỀU PHỐI NẠP NỘI DUNG
    // Sử dụng Iframe cho các module nặng/phức tạp để tránh xung đột CSS/JS
    if (viewFile === 'printdoc.html' || viewFile === 'views/loadExcel.html') {
        contentDiv.innerHTML = `
            <iframe src="${viewFile}?v=${timestamp}" 
                    class="w-full h-full border-none shadow-sm" 
                    style="min-height: 90vh; background: white; border-radius: 8px;">
            </iframe>`;
        return;
    }

    // Nạp các component nhẹ bằng fetch (Kanban, Admin, Profile...)
    try {
        await loadComponent("layout-content", viewFile);
        
        // Khởi tạo lại logic tương ứng cho từng view sau khi nạp
        if (viewFile === 'views/kanban.html') {
            if (typeof setupKanbanEvents === 'function') setupKanbanEvents();
        }
        if (viewFile === 'views/admin-users.html') {
            if (typeof loadAdminUsers === 'function') loadAdminUsers();
        }
        if (viewFile === 'views/admin-trainers.html') {
            if (typeof setupTrainerEvents === 'function') setupTrainerEvents();
        }
        if (viewFile === 'views/profile.html') {
            if (typeof setupProfileEvents === 'function') setupProfileEvents();
        }
    } catch (error) {
        console.error("Lỗi khi nạp view:", error);
        contentDiv.innerHTML = `<div class="p-4 text-red-500 text-center">Không thể nạp trang yêu cầu. Vui lòng thử lại.</div>`;
    }
};

/**
 * Hàm khởi tạo mặc định khi trang web sẵn sàng
 */
document.addEventListener('DOMContentLoaded', () => {
    // Mặc định nạp bảng điều khiển (Kanban) khi đăng nhập xong
    const defaultView = 'views/kanban.html';
    loadView(defaultView);
    
    // Xử lý sự kiện đăng xuất
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
                // Thêm logic đăng xuất firebase tại đây nếu cần
                window.location.href = 'login.html';
            }
        });
    }
});

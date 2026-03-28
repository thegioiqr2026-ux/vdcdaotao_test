/**
 * VDC CRM - Main Controller
 * Phiên bản: 4.9.2 (Bản hoàn thiện - Tích hợp loadComponent)
 * Chức năng: Điều phối View, Quản lý Sidebar & Iframe Navigation
 */

// 1. HÀM NẠP COMPONENT (Tích hợp để tránh lỗi ReferenceError)
async function loadComponent(id, file) {
    try {
        const response = await fetch(file);
        if (!response.ok) throw new Error(`Không thể tải file: ${file}`);
        const html = await response.text();
        const targetElement = document.getElementById(id);
        if (targetElement) {
            targetElement.innerHTML = html;
            return true;
        }
        return false;
    } catch (error) {
        console.error("Lỗi hệ thống khi nạp component:", error);
        return false;
    }
}

// 2. HÀM ĐIỀU PHỐI GIAO DIỆN CHÍNH
window.loadView = async function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    const sidebar = document.getElementById('layout-sidebar');
    
    if (!contentDiv) {
        console.error("Lỗi: Không tìm thấy vùng hiển thị 'layout-content'");
        return;
    }

    const timestamp = new Date().getTime();

    // TỰ ĐỘNG THU GỌN SIDEBAR KHI VÀO TRANG DỮ LIỆU LỚN
    if (sidebar) {
        if (viewFile === 'views/loadExcel.html' || viewFile === 'printdoc.html') {
            sidebar.classList.remove('expanded'); 
        } else {
            sidebar.classList.add('expanded');
        }
    }

    // HIỂN THỊ TRẠNG THÁI LOADING
    contentDiv.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#3b82f6;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem; margin-bottom:10px;"></i>
            <span style="font-size:12px; color:#64748b; font-weight:500;">Đang nạp hệ thống...</span>
        </div>`;

    // SỬ DỤNG IFRAME CHO MODULE THÔNG TIN HỌC VIÊN & IN THẺ
    if (viewFile === 'printdoc.html' || viewFile === 'views/loadExcel.html') {
        contentDiv.innerHTML = `
            <iframe src="${viewFile}?v=${timestamp}" 
                    style="width:100%; height:90vh; border:none; background:white; border-radius:8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            </iframe>`;
        return;
    }

    // NẠP CÁC TRANG COMPONENT (KANBAN, ADMIN...)
    try {
        const success = await loadComponent("layout-content", viewFile);
        if (success) {
            // Khởi tạo các sự kiện đặc thù sau khi nạp xong HTML
            if (viewFile === 'views/kanban.html' && typeof setupKanbanEvents === 'function') {
                setupKanbanEvents();
            }
            if (viewFile === 'views/admin-trainers.html' && typeof setupTrainerEvents === 'function') {
                setupTrainerEvents();
            }
        }
    } catch (error) {
        console.error("Lỗi khi nạp View:", error);
        contentDiv.innerHTML = `<div style="padding:20px; color:red; text-align:center;">Lỗi kết nối module: ${viewFile}</div>`;
    }
};

// 3. KHỞI CHẠY KHI TRANG SẴN SÀNG
document.addEventListener('DOMContentLoaded', () => {
    // Mặc định nạp Bảng điều khiển (Kanban)
    const defaultView = 'views/kanban.html';
    loadView(defaultView);
    
    // Xử lý nút Đăng xuất
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.onclick = function() {
            if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống VDC?")) {
                window.location.href = 'login.html';
            }
        };
    }
});

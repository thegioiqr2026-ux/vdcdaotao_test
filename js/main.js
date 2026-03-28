/**
 * VDC CRM - Main Controller
 * Phiên bản: 4.9
 * Khắc phục lỗi nạp trang chủ và đồng bộ Iframe
 */

window.loadView = async function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    const sidebar = document.getElementById('layout-sidebar');
    
    // Kiểm tra xem các phần tử HTML có tồn tại không để tránh lỗi trắng trang
    if (!contentDiv) {
        console.error("Lỗi: Không tìm thấy phần tử 'layout-content' trong index.html");
        return;
    }

    const timestamp = new Date().getTime();

    // 1. ĐIỀU KHIỂN SIDEBAR
    if (sidebar) {
        if (viewFile === 'views/loadExcel.html' || viewFile === 'printdoc.html') {
            sidebar.classList.remove('expanded'); 
        } else {
            sidebar.classList.add('expanded');
        }
    }

    // 2. HIỂN THỊ LOADING
    contentDiv.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#3b82f6;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem; margin-bottom:10px;"></i>
            <span style="font-size:12px; color:#64748b;">Đang nạp module...</span>
        </div>`;

    // 3. ĐIỀU PHỐI NẠP NỘI DUNG
    if (viewFile === 'printdoc.html' || viewFile === 'views/loadExcel.html') {
        contentDiv.innerHTML = `
            <iframe src="${viewFile}?v=${timestamp}" 
                    style="width:100%; height:90vh; border:none; background:white; border-radius:8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            </iframe>`;
        return;
    }

    // Nạp component bằng hàm loadComponent có sẵn trong hệ thống
    try {
        if (typeof loadComponent === 'function') {
            await loadComponent("layout-content", viewFile);
            
            // Khởi tạo lại logic sau khi nạp
            if (viewFile === 'views/kanban.html' && typeof setupKanbanEvents === 'function') setupKanbanEvents();
            if (viewFile === 'views/admin-trainers.html' && typeof setupTrainerEvents === 'function') setupTrainerEvents();
        } else {
            contentDiv.innerHTML = `<div style="padding:20px; color:red;">Lỗi: Hàm loadComponent chưa được định nghĩa.</div>`;
        }
    } catch (error) {
        console.error("Lỗi nạp view:", error);
        contentDiv.innerHTML = `<div style="padding:20px; color:red;">Không thể nạp: ${viewFile}</div>`;
    }
};

// Khởi tạo khi trang sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    // Đảm bảo nạp trang mặc định
    const defaultView = 'views/kanban.html';
    loadView(defaultView);
    
    // Sự kiện nút đăng xuất
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            if (confirm("Xác nhận đăng xuất?")) window.location.href = 'login.html';
        };
    }
});

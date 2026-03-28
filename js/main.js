/**
 * VDC CRM - Main Controller v5.2
 * Fix lỗi nạp View & Đồng bộ Sidebar
 */

/**
 * VDC CRM - Main Controller v6.1
 */
window.loadView = function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    const sidebar = document.getElementById('layout-sidebar');
    const timestamp = new Date().getTime();

    if (!contentDiv) return;

    // Sidebar Auto-Collapse
    if (sidebar) {
        if (viewFile.includes('loadExcel.html') || viewFile.includes('printdoc.html')) {
            sidebar.classList.remove('expanded');
        } else {
            sidebar.classList.add('expanded');
        }
    }

    // Hiển thị Loader
    contentDiv.innerHTML = `<div id="loader" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#3b82f6;"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i></div>`;

    // Sửa lỗi nạp Iframe trên GitHub: Đảm bảo đường dẫn luôn bắt đầu từ thư mục gốc
    const cleanPath = viewFile.startsWith('/') ? viewFile.substring(1) : viewFile;
    
    contentDiv.innerHTML += `
        <iframe src="${cleanPath}?v=${timestamp}" 
                style="width:100%; height:100%; border:none; position:relative; z-index:1; background:white;"
                onload="document.getElementById('loader').style.display='none'">
        </iframe>`;

    // 2. Nạp nội dung bằng Iframe để an toàn tuyệt đối
    contentDiv.innerHTML = `
        <div id="loader" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#3b82f6;">
            <i class="fa-solid fa-circle-notch fa-spin text-2xl"></i>
        </div>
        <iframe src="${viewFile}?v=${timestamp}" 
                style="width:100%; height:100%; border:none; position:relative; z-index:1; background:white;"
                onload="document.getElementById('loader').style.display='none'">
        </iframe>`;
};

// Khởi chạy khi trang sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    // Nạp trang Kanban làm mặc định
    loadView('views/kanban.html');
});

// Phiên bản: 1.8
// File Logic điều phối trung tâm của Dashboard (TEST)

import { auth, onAuthStateChanged, signOut } from './firebase-config.js';

// 1. KIỂM TRA BẢO MẬT NGAY KHI VỪA VÀO TRANG
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Chưa đăng nhập -> Đá ra khỏi cổng
        window.location.replace('login.html'); 
    } else {
        // Đã đăng nhập -> Gỡ bỏ tàng hình cho trang Web
        document.getElementById('appBody').classList.remove('hidden'); 
        initApp(user);
    }
});

// 2. HÀM TẢI MẢNH GHÉP (COMPONENTS)
async function loadComponent(id, file) {
    try {
        const response = await fetch(file);
        if (response.ok) {
            document.getElementById(id).innerHTML = await response.text();
        } else {
            console.error(`Không tìm thấy file: ${file}`);
        }
    } catch (error) { 
        console.error(`Lỗi tải ${file}:`, error); 
    }
}

// 3. HÀM KHỞI TẠO HỆ THỐNG KHI ĐĂNG NHẬP THÀNH CÔNG
function initApp(user) {
    // Tải thanh Menu bên trái
    loadComponent("layout-sidebar", "components/sidebar.html");
    
    // Tải thanh Footer bên dưới
    loadComponent("layout-footer", "components/footer.html");

    // Tải thanh Header phía trên và gắn thông tin người dùng
    loadComponent("layout-header", "components/header.html").then(() => {
        // Gắn Email người dùng lên góc phải màn hình
        const userDisplay = document.getElementById('userEmailDisplay');
        if (userDisplay) userDisplay.textContent = user.email;

        // Bắt sự kiện cho nút Đăng Xuất
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', async () => {
                await signOut(auth);
                window.location.replace('login.html');
            });
        }
    });
    
    // Mặc định nạp màn hình Kanban (Quy trình) vào vị trí Content khi vừa vào
    loadView('views/kanban.html');
}

// 4. HÀM CHUYỂN TRANG (DÙNG CHUNG CHO TOÀN BỘ MENU)
// Gắn vào window để các nút trên HTML (onclick) có thể gọi được
window.loadView = async function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    
    // Hiện icon xoay tròn trong lúc chờ tải dữ liệu
    contentDiv.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-blue-500">
            <i class="fa-solid fa-circle-notch fa-spin text-4xl mb-3"></i>
            <span class="font-medium text-gray-500">Đang tải giao diện...</span>
        </div>
    `;
    
    // Nhúng giao diện mới vào
    await loadComponent("layout-content", viewFile);
    
    // Lưu ý: Sau này các logic kéo dữ liệu (Kanban, Table) sẽ được kích hoạt tại đây
};

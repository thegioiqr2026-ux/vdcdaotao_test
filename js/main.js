// Phiên bản: 1.12
// File Logic điều phối trung tâm của Dashboard (TEST)

import { auth, db, onAuthStateChanged, signOut, ref, get, child, update } from './firebase-config.js';

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace('login.html'); 
    } else {
        document.getElementById('appBody').classList.remove('hidden'); 
        initApp(user);
    }
});

async function loadComponent(id, file) {
    try {
        const response = await fetch(file);
        if (response.ok) {
            document.getElementById(id).innerHTML = await response.text();
        } else {
            console.error(`Lỗi tải file: ${file}`);
        }
    } catch (error) { console.error(`Lỗi tải ${file}:`, error); }
}

async function initApp(user) {
    // 1. Tải xong toàn bộ khung xương trước khi làm việc khác
    await Promise.all([
        loadComponent("layout-sidebar", "components/sidebar.html"),
        loadComponent("layout-header", "components/header.html"),
        loadComponent("layout-footer", "components/footer.html")
    ]);

    // 2. Gắn thông tin hiển thị cơ bản
    const userDisplay = document.getElementById('userEmailDisplay');
    if (userDisplay) userDisplay.textContent = user.email;

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await signOut(auth);
            window.location.replace('login.html');
        });
    }

    // 3. KIỂM TRA QUYỀN ADMIN TỪ FIREBASE ĐỂ MỞ KHÓA MENU
    const safeEmail = user.email.replace(/\./g, '_');
    try {
        const roleSnapshot = await get(child(ref(db), `AccessControl/${safeEmail}/Role`));
        const userRole = roleSnapshot.exists() ? roleSnapshot.val() : 'NhanVien';
        
        // Nếu là Admin, gỡ bỏ class 'hidden' của nút Menu
        if (userRole === 'Admin') {
            const adminMenu = document.getElementById('menuAdminUsers');
            if (adminMenu) adminMenu.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Lỗi kiểm tra quyền: ", err);
    }
    
    // 4. Mặc định load màn hình Kanban
    loadView('views/kanban.html');
}

window.loadView = async function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    contentDiv.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-blue-500"><i class="fa-solid fa-circle-notch fa-spin text-4xl mb-3"></i><span class="font-medium text-gray-500">Đang tải giao diện...</span></div>`;
    
    await loadComponent("layout-content", viewFile);
    
    // Kích hoạt logic riêng cho từng màn hình
    if (viewFile === 'views/admin-users.html') {
        loadAdminUsers();
    }
};

// ==========================================
// LOGIC MÀN HÌNH QUẢN LÝ TÀI KHOẢN (ADMIN)
// ==========================================
window.loadAdminUsers = async function() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    try {
        const snapshot = await get(child(ref(db), `AccessControl`));
        if (snapshot.exists()) {
            let html = '';
            snapshot.forEach((childSnapshot) => {
                const safeEmail = childSnapshot.key;
                const data = childSnapshot.val();
                
                const isLocked = data.TrangThai !== 'Active';
                const statusBadge = isLocked 
                    ? `<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Bị Khóa</span>`
                    : `<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Hoạt động</span>`;
                
                const roleBadge = data.Role === 'Admin'
                    ? `<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-crown mr-1"></i> Admin</span>`
                    : `<span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">Nhân viên</span>`;

                html += `
                    <tr class="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                        <td class="p-4 font-medium text-gray-800">${data.HoTen || 'Chưa cập nhật'}</td>
                        <td class="p-4 text-gray-600">${data.Email}</td>
                        <td class="p-4 text-center">${roleBadge}</td>
                        <td class="p-4 text-center">${statusBadge}</td>
                        <td class="p-4 text-center">
                            <button onclick="toggleUserStatus('${safeEmail}', '${data.TrangThai}')" class="text-xs font-bold px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors mr-1" title="Khóa/Mở khóa">
                                <i class="fa-solid ${isLocked ? 'fa-unlock text-green-600' : 'fa-lock text-red-600'}"></i>
                            </button>
                            <button onclick="toggleUserRole('${safeEmail}', '${data.Role}')" class="text-xs font-bold px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors" title="Thăng/Giáng cấp Admin">
                                <i class="fa-solid fa-user-shield text-blue-600"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400">Chưa có dữ liệu tài khoản nào.</td></tr>`;
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Lỗi tải dữ liệu: ${error.message}</td></tr>`;
    }
};

window.toggleUserStatus = async function(safeEmail, currentStatus) {
    if(!confirm('Bạn có chắc chắn muốn thay đổi trạng thái đăng nhập của tài khoản này?')) return;
    const newStatus = currentStatus === 'Active' ? 'Locked' : 'Active';
    await update(ref(db, `AccessControl/${safeEmail}`), { TrangThai: newStatus });
    loadAdminUsers();
};

window.toggleUserRole = async function(safeEmail, currentRole) {
    if(!confirm('Bạn có chắc chắn muốn thay đổi quyền hạn của tài khoản này?')) return;
    const newRole = currentRole === 'Admin' ? 'NhanVien' : 'Admin';
    await update(ref(db, `AccessControl/${safeEmail}`), { Role: newRole });
    loadAdminUsers();
};

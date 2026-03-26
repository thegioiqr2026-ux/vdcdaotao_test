// Phiên bản: 1.31
// Chức năng: Fix nút Đăng xuất, Phân quyền Admin mở khóa tài khoản, Đổi mật khẩu, Bypass Cache

import { auth, db, onAuthStateChanged, signOut, ref, get, child, update, push } from './firebase-config.js';
import { updatePassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"; 

const GAS_URL_SYSTEM = "https://script.google.com/macros/s/AKfycbxRNpGczbDYLXpJliEOHhcubc41qm-x7DW47MsVz1W6Ne3BJTMWYs98ciWE5SkY2MWY/exec";

window.currentUserRole = 'NhanVien'; 

// HÀM CHỐNG LƯU CACHE GIAO DIỆN
async function loadComponent(id, file) {
    try {
        const noCacheUrl = file + '?v=' + new Date().getTime(); 
        const response = await fetch(noCacheUrl);
        if (response.ok) {
            document.getElementById(id).innerHTML = await response.text();
        }
    } catch (error) { console.error(`Lỗi tải ${file}:`, error); }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { 
        window.location.replace('login.html'); 
    } else { 
        // 1. KIỂM TRA TRẠNG THÁI TÀI KHOẢN KHI VỪA VÀO
        const safeEmail = user.email.replace(/\./g, '_');
        const userRef = ref(db, `AccessControl/${safeEmail}`);
        const snap = await get(userRef);

        if (!snap.exists()) {
            // Tài khoản hoàn toàn mới -> Tự tạo DB, gán là Locked và đá ra ngoài
            await update(userRef, { Email: user.email, Role: 'NhanVien', TrangThai: 'Locked' });
            alert("Tài khoản mới đăng ký. Vui lòng chờ Admin phê duyệt để có thể truy cập hệ thống!");
            await signOut(auth);
            window.location.replace('login.html');
            return;
        } else {
            const data = snap.val();
            window.currentUserRole = data.Role || 'NhanVien';
            // Nếu bị khóa và không phải là Admin tối cao thì đá ra ngoài
            if (data.TrangThai !== 'Active' && data.Role !== 'Admin') {
                alert("Tài khoản của bạn đang bị khóa hoặc chưa được phê duyệt!");
                await signOut(auth);
                window.location.replace('login.html');
                return;
            }
        }

        // Nếu hợp lệ, mở app
        document.getElementById('appBody').classList.remove('hidden'); 
        initApp(user); 
    }
});

async function initApp(user) {
    // Chờ tải xong khung xương HTML thì mới chạy tiếp
    await loadComponent("layout-sidebar", "components/sidebar.html");
    await loadComponent("layout-header", "components/header.html");
    await loadComponent("layout-footer", "components/footer.html");

    // 2. GẮN DỮ LIỆU & SỰ KIỆN NÚT BẤM (Fix lỗi nứt Thoát)
    const userDisplay = document.getElementById('userEmailDisplay');
    if (userDisplay) userDisplay.textContent = user.email;
    
    const adminMenu = document.getElementById('menuAdminUsers');
    if (adminMenu && window.currentUserRole === 'Admin') adminMenu.classList.remove('hidden');

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.stopPropagation(); // Chặn sự kiện click nhầm vào trang Profile
            if(confirm("Bạn muốn đăng xuất khỏi hệ thống?")) {
                await signOut(auth); 
                window.location.replace('login.html');
            }
        });
    }

    loadView('views/kanban.html');
}

window.loadView = async function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    contentDiv.innerHTML = `<div class="flex items-center justify-center h-full"><i class="fa-solid fa-spinner fa-spin text-3xl text-blue-500"></i></div>`;
    await loadComponent("layout-content", viewFile);
    
    if (viewFile === 'views/kanban.html') setupKanbanEvents();
    if (viewFile === 'views/admin-users.html') loadAdminUsers();
    if (viewFile === 'views/admin-trainers.html') setupTrainerEvents();
    if (viewFile === 'views/profile.html') setupProfileEvents();
};

// ==========================================
// HỒ SƠ & ĐỔI MẬT KHẨU (V1.31)
// ==========================================
window.setupProfileEvents = function() {
    setTimeout(() => {
        const user = auth.currentUser;
        if(user) document.getElementById('profileEmail').value = user.email;

        const form = document.getElementById('formChangePassword');
        if(form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const newPass = document.getElementById('newPass').value;
                try {
                    await updatePassword(auth.currentUser, newPass);
                    alert("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
                    await signOut(auth);
                    window.location.replace('login.html');
                } catch (error) {
                    alert("Lỗi: " + error.message + "\n(Gợi ý: Nếu báo lỗi xác thực, bạn cần đăng xuất và đăng nhập lại trước khi đổi mật khẩu).");
                }
            };
        }
    }, 200);
};

// ==========================================
// QUẢN LÝ TÀI KHOẢN & ADMIN MỞ KHÓA (V1.31)
// ==========================================
window.loadAdminUsers = async function() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    const snapshot = await get(child(ref(db), `AccessControl`));
    if (snapshot.exists()) {
        let html = '';
        snapshot.forEach((snap) => {
            const safeEmail = snap.key;
            const d = snap.val();
            const isLocked = d.TrangThai !== 'Active';
            const statusBadge = isLocked 
                ? '<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold uppercase">Bị Khóa</span>' 
                : '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase">Hoạt Động</span>';
            
            // Nút bấm Mở/Khóa chỉ hoạt động đối với người khác, không tự khóa mình
            const btnAction = (auth.currentUser && auth.currentUser.email !== d.Email) 
                ? `<button onclick="toggleUserStatus('${safeEmail}', '${d.TrangThai}')" class="text-[11px] px-3 py-1 rounded font-bold ${isLocked ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'} transition-colors">${isLocked ? 'Duyệt / Mở' : 'Khóa User'}</button>` 
                : `<span class="text-xs text-gray-400 italic">Bạn</span>`;

            html += `<tr class="border-b hover:bg-slate-50">
                        <td class="p-4 font-bold text-gray-700">${d.HoTen || 'Chưa cập nhật'}</td>
                        <td class="p-4 text-sm text-blue-600">${d.Email}</td>
                        <td class="p-4 text-center font-bold text-amber-600">${d.Role}</td>
                        <td class="p-4 text-center">${statusBadge}</td>
                        <td class="p-4 text-center">${btnAction}</td>
                     </tr>`;
        });
        tbody.innerHTML = html;
    }
};

window.toggleUserStatus = async function(safeEmail, currentStatus) {
    const newStatus = currentStatus === 'Active' ? 'Locked' : 'Active';
    const action = currentStatus === 'Active' ? 'KHÓA' : 'MỞ KHÓA (DUYỆT)';
    if(!confirm(`Bạn có chắc chắn muốn ${action} tài khoản này không?`)) return;
    try {
        await update(ref(db, `AccessControl/${safeEmail}`), { TrangThai: newStatus });
        loadAdminUsers(); // Tải lại bảng
    } catch (e) { alert("Lỗi phân quyền: " + e.message); }
};

// ... CÁC HÀM CŨ (Kanban, Giảng viên, K.Tra trùng lặp) GIỮ NGUYÊN BÊN DƯỚI ...
// Anh dán nối đoạn Kanban & Giảng viên của bản 1.27 vào dưới dòng này nhé để tiết kiệm không gian!
// (Em đã chuẩn bị sẵn khung ở trên, anh copy các hàm getDistance, autoFill, submitNewClass dán vào là chạy)

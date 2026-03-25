// Phiên bản: 1.17
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
    await Promise.all([
        loadComponent("layout-sidebar", "components/sidebar.html"),
        loadComponent("layout-header", "components/header.html"),
        loadComponent("layout-footer", "components/footer.html")
    ]);

    const userDisplay = document.getElementById('userEmailDisplay');
    if (userDisplay) userDisplay.textContent = user.email;

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await signOut(auth);
            window.location.replace('login.html');
        });
    }

    const safeEmail = user.email.replace(/\./g, '_');
    try {
        const roleSnapshot = await get(child(ref(db), `AccessControl/${safeEmail}/Role`));
        const userRole = roleSnapshot.exists() ? roleSnapshot.val() : 'NhanVien';
        
        const adminMenu = document.getElementById('menuAdminUsers');
        if (adminMenu) {
            if (userRole === 'Admin') {
                adminMenu.classList.remove('hidden');
                adminMenu.classList.add('flex');
            } else {
                adminMenu.classList.add('hidden');
                adminMenu.classList.remove('flex');
            }
        }
    } catch (err) {
        console.error("Lỗi kiểm tra quyền: ", err);
    }
    
    loadView('views/kanban.html');
}

window.loadView = async function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    contentDiv.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-blue-500"><i class="fa-solid fa-circle-notch fa-spin text-4xl mb-3"></i><span class="font-medium text-gray-500">Đang tải giao diện...</span></div>`;
    
    await loadComponent("layout-content", viewFile);
    
    if (viewFile === 'views/admin-users.html') {
        loadAdminUsers();
    } else if (viewFile === 'views/kanban.html') {
        setupKanbanEvents();
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

// ==========================================
// LOGIC MÀN HÌNH KANBAN (KÉO THẢ & FIREBASE)
// ==========================================

window.loadKanbanData = async function() {
    const cols = ['B1_BaoGia', 'B4_ChuanBi', 'B5_DangDay', 'B6_ChoInPhoi', 'B7_HoanTat'];
    
    cols.forEach(c => {
        const el = document.getElementById('col_' + c);
        if(el) el.innerHTML = '';
    });

    try {
        const snapshot = await get(ref(db, 'KhachHang'));
        if (snapshot.exists()) {
            snapshot.forEach(khSnap => {
                const mst = khSnap.key;
                const khData = khSnap.val();
                const tenCongTy = khData.ThongTinGoc?.TenCongTy || "Chưa cập nhật tên";
                
                if (khData.CacLopHuanLuyen) {
                    Object.keys(khData.CacLopHuanLuyen).forEach(lopId => {
                        const lopData = khData.CacLopHuanLuyen[lopId];
                        const status = lopData.TrangThai || 'B1_BaoGia';
                        
                        const cardHTML = `
                            <div class="bg-white p-3.5 rounded-lg shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md transition-all" 
                                 draggable="true" 
                                 ondragstart="dragCard(event, '${mst}', '${lopId}')">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-wider">${mst}</span>
                                    <span class="text-[10px] text-gray-400 font-medium">${lopId}</span>
                                </div>
                                <h3 class="font-bold text-gray-800 text-sm mb-1 leading-snug">${tenCongTy}</h3>
                                <p class="text-[10px] text-gray-500"><i class="fa-regular fa-clock mr-1"></i>Tạo: ${lopData.NgayTao || 'N/A'}</p>
                            </div>
                        `;
                        
                        const colEl = document.getElementById('col_' + status);
                        if(colEl) {
                            colEl.insertAdjacentHTML('beforeend', cardHTML);
                        }
                    });
                }
            });
        }
    } catch (error) {
        console.error("Lỗi tải Kanban:", error);
    }
};

window.dragCard = function(ev, mst, lopId) {
    ev.dataTransfer.setData("mst", mst);
    ev.dataTransfer.setData("lopId", lopId);
};

window.allowDrop = function(ev) {
    ev.preventDefault();
};

window.dropCard = async function(ev, newStatus) {
    ev.preventDefault();
    const mst = ev.dataTransfer.getData("mst");
    const lopId = ev.dataTransfer.getData("lopId");
    
    if(!mst || !lopId) return;

    try {
        await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lopId}`), { 
            TrangThai: newStatus 
        });
        loadKanbanData();
    } catch(err) {
        alert("Lỗi khi chuyển trạng thái: " + err.message);
    }
};

// --- HÀM MỚI: TỰ ĐỘNG ĐIỀN TÊN CÔNG TY VÀ SINH MÃ LỚP ---
window.autoFillData = async function() {
    const mstInput = document.getElementById('newMST');
    const tenInput = document.getElementById('newTenCTY');
    const lopInput = document.getElementById('newLop');
    
    const mst = mstInput.value.trim();
    if (!mst) return;

    const currentYear = new Date().getFullYear().toString();
    let nextStt = 1;

    try {
        // 1. Tìm xem Công ty này đã có Tên chưa, nếu có thì tự điền
        const snapTen = await get(child(ref(db), `KhachHang/${mst}/ThongTinGoc/TenCongTy`));
        if (snapTen.exists() && tenInput.value.trim() === '') {
            tenInput.value = snapTen.val();
        }

        // 2. Đếm số lớp của Công ty này trong Năm nay để tính STT
        const snapLop = await get(child(ref(db), `KhachHang/${mst}/CacLopHuanLuyen`));
        if (snapLop.exists()) {
            const cacLop = snapLop.val();
            const prefix = `${mst}-${currentYear}-`;
            let maxStt = 0;
            
            Object.keys(cacLop).forEach(key => {
                if (key.startsWith(prefix)) {
                    const parts = key.split('-');
                    const stt = parseInt(parts[parts.length - 1]);
                    if (!isNaN(stt) && stt > maxStt) {
                        maxStt = stt;
                    }
                }
            });
            nextStt = maxStt + 1;
        }

        // 3. Tự động sinh mã vào ô (chỉ sinh khi ô còn trống hoặc đang chứa mã cũ do hệ thống tự sinh)
        if (lopInput.value.trim() === '' || lopInput.value.startsWith(mst)) {
            lopInput.value = `${mst}-${currentYear}-${nextStt}`;
        }

    } catch (err) {
        console.error("Lỗi tự động điền dữ liệu: ", err);
    }
};

window.submitNewClass = async function(ev) {
    ev.preventDefault();
    const btn = document.getElementById('btnSubmitCreate');
    if(!btn) return;

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    const mst = document.getElementById('newMST').value.trim();
    const ten = document.getElementById('newTenCTY').value.trim();
    const lop = document.getElementById('newLop').value.trim();
    
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth()+1).toString().padStart(2, '0')}/${today.getFullYear()}`;

    try {
        await update(ref(db, `KhachHang/${mst}/ThongTinGoc`), { 
            TenCongTy: ten,
            MST: mst // Bổ sung lưu luôn thuộc tính MST cho chắc chắn
        });
        await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lop}`), { 
            TrangThai: "B1_BaoGia",
            NgayTao: dateStr
        });
        
        document.getElementById('modalCreate').classList.add('hidden');
        document.getElementById('formCreateClass').reset();
        loadKanbanData();
    } catch(err) {
        alert("Lỗi: " + err.message);
    }
    btn.innerHTML = 'Tạo mới';
    btn.disabled = false;
};

window.setupKanbanEvents = function() {
    setTimeout(() => {
        loadKanbanData();
        
        // Gắn sự kiện cho Form Lên Đơn
        const form = document.getElementById('formCreateClass');
        if(form) {
            form.removeEventListener('submit', submitNewClass);
            form.addEventListener('submit', submitNewClass);
        }

        // Gắn sự kiện kích hoạt tự động sinh mã khi vừa gõ xong MST (Rời chuột khỏi ô nhập)
        const mstInput = document.getElementById('newMST');
        if(mstInput) {
            mstInput.removeEventListener('blur', autoFillData);
            mstInput.addEventListener('blur', autoFillData);
        }
    }, 200);
};

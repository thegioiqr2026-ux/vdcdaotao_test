// Phiên bản: 1.19
// File Logic điều phối trung tâm của Dashboard
// Chức năng: Phân quyền, Kanban, Tra cứu MST Quốc gia & Tự động sinh Mã lớp

import { auth, db, onAuthStateChanged, signOut, ref, get, child, update } from './firebase-config.js';

// LINK WEB APP GAS MỚI CỦA ANH
const GAS_URL_SYSTEM = "https://script.google.com/macros/s/AKfycbxRNpGczbDYLXpJliEOHhcubc41qm-x7DW47MsVz1W6Ne3BJTMWYs98ciWE5SkY2MWY/exec";

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
    } catch (err) { console.error("Lỗi kiểm tra quyền:", err); }
    
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
// LOGIC KANBAN & TRA CỨU THÔNG MINH
// ==========================================

window.loadKanbanData = async function() {
    const cols = ['B1_BaoGia', 'B4_ChuanBi', 'B5_DangDay', 'B6_ChoInPhoi', 'B7_HoanTat'];
    cols.forEach(c => { const el = document.getElementById('col_' + c); if(el) el.innerHTML = ''; });

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
                        const noiDung = lopData.NoiDungHuanLuyen || '';
                        const hienThiNoiDung = noiDung ? `<p class="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100 mb-2 leading-tight italic line-clamp-2" title="${noiDung}">${noiDung}</p>` : '';

                        const cardHTML = `
                            <div class="bg-white p-3.5 rounded-lg shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md transition-all group" 
                                 draggable="true" ondragstart="dragCard(event, '${mst}', '${lopId}')">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">${mst}</span>
                                    <span class="text-[10px] text-gray-400 font-medium group-hover:text-blue-500 transition-colors">${lopId}</span>
                                </div>
                                <h3 class="font-bold text-gray-800 text-sm mb-2 leading-snug">${tenCongTy}</h3>
                                ${hienThiNoiDung}
                                <p class="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><i class="fa-regular fa-calendar"></i> ${lopData.NgayTao || 'N/A'}</p>
                            </div>
                        `;
                        const colEl = document.getElementById('col_' + status);
                        if(colEl) colEl.insertAdjacentHTML('beforeend', cardHTML);
                    });
                }
            });
        }
    } catch (error) { console.error("Lỗi tải Kanban:", error); }
};

window.dragCard = (ev, mst, lopId) => { ev.dataTransfer.setData("mst", mst); ev.dataTransfer.setData("lopId", lopId); };
window.allowDrop = (ev) => ev.preventDefault();

window.dropCard = async (ev, newStatus) => {
    ev.preventDefault();
    const mst = ev.dataTransfer.getData("mst");
    const lopId = ev.dataTransfer.getData("lopId");
    if(!mst || !lopId) return;
    try {
        await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lopId}`), { TrangThai: newStatus });
        loadKanbanData();
    } catch(err) { alert("Lỗi khi chuyển trạng thái: " + err.message); }
};

// --- HÀM TRA CỨU MST QUA GAS ---
window.autoFillData = async function() {
    const mstInput = document.getElementById('newMST');
    const tenInput = document.getElementById('newTenCTY');
    const lopInput = document.getElementById('newLop');
    const mst = mstInput.value.trim();
    if (!mst) return;

    const currentYear = new Date().getFullYear().toString();
    let nextStt = 1;

    try {
        // 1. Kiểm tra Firebase trước
        const snapTen = await get(child(ref(db), `KhachHang/${mst}/ThongTinGoc/TenCongTy`));
        let foundName = "";

        if (snapTen.exists()) {
            foundName = snapTen.val();
        } else {
            // 2. Nếu không có, gọi GAS tra cứu
            tenInput.placeholder = "Đang tra cứu dữ liệu...";
            tenInput.disabled = true;
            try {
                const res = await fetch(GAS_URL_SYSTEM, {
                    method: 'POST',
                    body: JSON.stringify({ type: "lookup_mst", mst: mst })
                });
                const result = await res.json();
                if (result.success) foundName = result.tenCongTy;
            } catch (e) { console.error("Lỗi API GAS:", e); }
            tenInput.disabled = false;
            tenInput.placeholder = "";
        }

        if (foundName && tenInput.value.trim() === '') tenInput.value = foundName;

        // 3. Sinh mã lớp
        const snapLop = await get(child(ref(db), `KhachHang/${mst}/CacLopHuanLuyen`));
        if (snapLop.exists()) {
            const cacLop = snapLop.val();
            const prefix = `${mst}-${currentYear}-`;
            let maxStt = 0;
            Object.keys(cacLop).forEach(key => {
                if (key.startsWith(prefix)) {
                    const stt = parseInt(key.split('-').pop());
                    if (!isNaN(stt) && stt > maxStt) maxStt = stt;
                }
            });
            nextStt = maxStt + 1;
        }
        if (lopInput.value.trim() === '' || lopInput.value.startsWith(mst)) {
            lopInput.value = `${mst}-${currentYear}-${nextStt}`;
        }
    } catch (err) { console.error("Lỗi autoFill:", err); }
};

window.submitNewClass = async function(ev) {
    ev.preventDefault();
    const btn = document.getElementById('btnSubmitCreate');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    const mst = document.getElementById('newMST').value.trim();
    const ten = document.getElementById('newTenCTY').value.trim();
    const lop = document.getElementById('newLop').value.trim();
    const noidung = document.getElementById('newNoiDung')?.value.trim() || "";
    const dateStr = new Date().toLocaleDateString('vi-VN');

    try {
        await update(ref(db, `KhachHang/${mst}/ThongTinGoc`), { TenCongTy: ten, MST: mst });
        await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lop}`), { 
            TrangThai: "B1_BaoGia", NgayTao: dateStr, NoiDungHuanLuyen: noidung 
        });
        document.getElementById('modalCreate').classList.add('hidden');
        document.getElementById('formCreateClass').reset();
        loadKanbanData();
    } catch(err) { alert("Lỗi: " + err.message); }
    btn.innerHTML = 'Tạo mới';
    btn.disabled = false;
};

window.setupKanbanEvents = function() {
    setTimeout(() => {
        loadKanbanData();
        const form = document.getElementById('formCreateClass');
        if(form) { form.removeEventListener('submit', submitNewClass); form.addEventListener('submit', submitNewClass); }
        const mstInput = document.getElementById('newMST');
        if(mstInput) { mstInput.removeEventListener('blur', autoFillData); mstInput.addEventListener('blur', autoFillData); }
    }, 200);
};

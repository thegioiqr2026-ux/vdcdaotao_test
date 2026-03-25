// Phiên bản: 1.21
// Chức năng: Kanban, Tra cứu MST (Tên + Địa chỉ), Chuẩn hóa MST & Tự động sinh Mã lớp

import { auth, db, onAuthStateChanged, signOut, ref, get, child, update } from './firebase-config.js';

const GAS_URL_SYSTEM = "https://script.google.com/macros/s/AKfycbxRNpGczbDYLXpJliEOHhcubc41qm-x7DW47MsVz1W6Ne3BJTMWYs98ciWE5SkY2MWY/exec";

onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.replace('login.html'); } 
    else { document.getElementById('appBody').classList.remove('hidden'); initApp(user); }
});

async function loadComponent(id, file) {
    try {
        const response = await fetch(file);
        if (response.ok) document.getElementById(id).innerHTML = await response.text();
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
    if (btnLogout) btnLogout.addEventListener('click', async () => { await signOut(auth); window.location.replace('login.html'); });
    
    const safeEmail = user.email.replace(/\./g, '_');
    const roleSnapshot = await get(child(ref(db), `AccessControl/${safeEmail}/Role`));
    const userRole = roleSnapshot.exists() ? roleSnapshot.val() : 'NhanVien';
    const adminMenu = document.getElementById('menuAdminUsers');
    if (adminMenu) {
        if (userRole === 'Admin') { adminMenu.classList.remove('hidden'); adminMenu.classList.add('flex'); }
        else { adminMenu.classList.add('hidden'); adminMenu.classList.remove('flex'); }
    }
    loadView('views/kanban.html');
}

window.loadView = async function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    contentDiv.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-blue-500"><i class="fa-solid fa-circle-notch fa-spin text-4xl mb-3"></i></div>`;
    await loadComponent("layout-content", viewFile);
    if (viewFile === 'views/kanban.html') setupKanbanEvents();
    if (viewFile === 'views/admin-users.html') loadAdminUsers();
};

// --- LOGIC KANBAN ---
window.loadKanbanData = async function() {
    const cols = ['B1_BaoGia', 'B4_ChuanBi', 'B5_DangDay', 'B6_ChoInPhoi', 'B7_HoanTat'];
    cols.forEach(c => { const el = document.getElementById('col_' + c); if(el) el.innerHTML = ''; });
    const snapshot = await get(ref(db, 'KhachHang'));
    if (snapshot.exists()) {
        snapshot.forEach(khSnap => {
            const mst = khSnap.key;
            const khData = khSnap.val();
            if (khData.CacLopHuanLuyen) {
                Object.keys(khData.CacLopHuanLuyen).forEach(lopId => {
                    const lopData = khData.CacLopHuanLuyen[lopId];
                    const status = lopData.TrangThai || 'B1_BaoGia';
                    const cardHTML = `
                        <div class="bg-white p-3.5 rounded-lg shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-blue-400 transition-all group" 
                             draggable="true" ondragstart="dragCard(event, '${mst}', '${lopId}')">
                            <div class="flex justify-between items-start mb-1">
                                <span class="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">${mst}</span>
                                <span class="text-[9px] text-gray-400">${lopId}</span>
                            </div>
                            <h3 class="font-bold text-gray-800 text-xs mb-1">${khData.ThongTinGoc?.TenCongTy || "N/A"}</h3>
                            <p class="text-[10px] text-gray-500 line-clamp-1 mb-2 italic"><i class="fa-solid fa-location-dot mr-1"></i>${khData.ThongTinGoc?.DiaChi || "Chưa có địa chỉ"}</p>
                            <p class="text-[10px] text-slate-500 bg-slate-50 p-1 rounded border border-slate-100 line-clamp-2 mb-2">${lopData.NoiDungHuanLuyen || ''}</p>
                            <p class="text-[9px] text-gray-400"><i class="fa-regular fa-calendar mr-1"></i>${lopData.NgayTao || 'N/A'}</p>
                        </div>`;
                    const colEl = document.getElementById('col_' + status);
                    if(colEl) colEl.insertAdjacentHTML('beforeend', cardHTML);
                });
            }
        });
    }
};

window.dragCard = (ev, mst, lopId) => { ev.dataTransfer.setData("mst", mst); ev.dataTransfer.setData("lopId", lopId); };
window.allowDrop = (ev) => ev.preventDefault();
window.dropCard = async (ev, newStatus) => {
    ev.preventDefault();
    const mst = ev.dataTransfer.getData("mst");
    const lopId = ev.dataTransfer.getData("lopId");
    if(mst && lopId) {
        await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lopId}`), { TrangThai: newStatus });
        loadKanbanData();
    }
};

// --- TRA CỨU MST THÔNG MINH (BẢN V1.21) ---
window.autoFillData = async function() {
    const mstInput = document.getElementById('newMST');
    const tenInput = document.getElementById('newTenCTY');
    const diaChiInput = document.getElementById('newDiaChi');
    const lopInput = document.getElementById('newLop');
    
    let mst = mstInput.value.trim();
    if (!mst) return;
    if (mst.length === 9 && !mst.startsWith('0')) { mst = '0' + mst; mstInput.value = mst; }

    try {
        const snap = await get(child(ref(db), `KhachHang/${mst}/ThongTinGoc`));
        let foundName = "", foundAddr = "";

        if (snap.exists()) {
            const data = snap.val();
            foundName = data.TenCongTy;
            foundAddr = data.DiaChi || "";
        } else {
            tenInput.placeholder = "Đang tra cứu tên...";
            diaChiInput.placeholder = "Đang tra cứu địa chỉ...";
            const res = await fetch(GAS_URL_SYSTEM, { method: 'POST', body: JSON.stringify({ type: "lookup_mst", mst: mst }) });
            const result = await res.json();
            if (result.success) {
                foundName = result.tenCongTy;
                foundAddr = result.diaChi;
            }
            tenInput.placeholder = ""; diaChiInput.placeholder = "";
        }

        if (foundName && !tenInput.value.trim()) tenInput.value = foundName;
        if (foundAddr && !diaChiInput.value.trim()) diaChiInput.value = foundAddr;

        // Sinh mã lớp
        const year = new Date().getFullYear();
        const snapLop = await get(child(ref(db), `KhachHang/${mst}/CacLopHuanLuyen`));
        let nextStt = 1;
        if (snapLop.exists()) {
            const keys = Object.keys(snapLop.val());
            const prefix = `${mst}-${year}-`;
            const stts = keys.filter(k => k.startsWith(prefix)).map(k => parseInt(k.split('-').pop()));
            if (stts.length > 0) nextStt = Math.max(...stts) + 1;
        }
        if (!lopInput.value.trim() || lopInput.value.includes(mst.substring(1))) {
            lopInput.value = `${mst}-${year}-${nextStt}`;
        }
    } catch (e) { console.error(e); }
};

window.submitNewClass = async function(ev) {
    ev.preventDefault();
    const btn = document.getElementById('btnSubmitCreate');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;

    const mst = document.getElementById('newMST').value.trim();
    const ten = document.getElementById('newTenCTY').value.trim();
    const diachi = document.getElementById('newDiaChi').value.trim();
    const lop = document.getElementById('newLop').value.trim();
    const noidung = document.getElementById('newNoiDung')?.value.trim() || "";
    const dateStr = new Date().toLocaleDateString('vi-VN');

    try {
        await update(ref(db, `KhachHang/${mst}/ThongTinGoc`), { TenCongTy: ten, DiaChi: diachi, MST: mst });
        await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lop}`), { 
            TrangThai: "B1_BaoGia", NgayTao: dateStr, NoiDungHuanLuyen: noidung 
        });
        document.getElementById('modalCreate').classList.add('hidden');
        document.getElementById('formCreateClass').reset();
        loadKanbanData();
    } catch(err) { alert(err.message); }
    btn.innerHTML = 'Tạo mới'; btn.disabled = false;
};

window.setupKanbanEvents = function() {
    setTimeout(() => {
        loadKanbanData();
        const form = document.getElementById('formCreateClass');
        if(form) form.addEventListener('submit', submitNewClass);
        const mstIn = document.getElementById('newMST');
        if(mstIn) mstIn.addEventListener('blur', autoFillData);
    }, 200);
};

// --- Hết file main.js ---

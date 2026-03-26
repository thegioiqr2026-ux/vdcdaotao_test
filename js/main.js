// Phiên bản: 1.25
// Chức năng: Kanban, Tra cứu MST, Tự động chuyển bước, Quản lý & Định vị Giảng viên gần nhất

import { auth, db, onAuthStateChanged, signOut, ref, get, child, update, push } from './firebase-config.js';

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
    
    const safeEmail = user.email.replace(/\./g, '_');
    const roleSnapshot = await get(child(ref(db), `AccessControl/${safeEmail}/Role`));
    const userRole = roleSnapshot.exists() ? roleSnapshot.val() : 'NhanVien';
    const adminMenu = document.getElementById('menuAdminUsers');
    if (adminMenu && userRole === 'Admin') adminMenu.classList.remove('hidden');

    loadView('views/kanban.html');
}

window.loadView = async function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    contentDiv.innerHTML = `<div class="flex items-center justify-center h-full"><i class="fa-solid fa-spinner fa-spin text-3xl text-blue-500"></i></div>`;
    await loadComponent("layout-content", viewFile);
    if (viewFile === 'views/kanban.html') setupKanbanEvents();
    if (viewFile === 'views/admin-users.html') loadAdminUsers();
    if (viewFile === 'views/admin-trainers.html') loadTrainers();
};

// ==========================================
// LOGIC KANBAN & TỰ ĐỘNG HÓA (V1.25)
// ==========================================

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
                        <div class="bg-white p-3.5 rounded-lg shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-blue-400 transition-all mb-3" 
                             draggable="true" ondragstart="dragCard(event, '${mst}', '${lopId}')">
                            <div class="flex justify-between items-start mb-1">
                                <span class="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">${mst}</span>
                                <span class="text-[9px] text-gray-400">${lopId}</span>
                            </div>
                            <h3 class="font-bold text-gray-800 text-xs mb-1 uppercase">${khData.ThongTinGoc?.TenCongTy || "N/A"}</h3>
                            <p class="text-[10px] text-gray-500 line-clamp-1 mb-2 italic"><i class="fa-solid fa-location-dot mr-1 text-red-400"></i>${khData.ThongTinGoc?.DiaChi || "Chưa có địa chỉ"}</p>
                            ${status === 'B1_BaoGia' ? `<button onclick="sendProfileAndMoveStep('${mst}', '${lopId}', 'khachhang@email.com', '${khData.ThongTinGoc?.TenCongTy}')" class="w-full mt-2 py-1 text-[10px] bg-green-500 text-white rounded hover:bg-green-600 font-bold transition-all"><i class="fa-solid fa-paper-plane mr-1"></i> GỬI HỒ SƠ MẪU</button>` : ''}
                            ${status === 'B4_ChuanBi' ? `<button onclick="findNearestTrainers('${khData.ThongTinGoc?.DiaChi}')" class="w-full mt-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 font-bold transition-all"><i class="fa-solid fa-user-tie mr-1"></i> CHỌN GIẢNG VIÊN GẦN NHẤT</button>` : ''}
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

// --- LOGIC TỰ ĐỘNG CHUYỂN BƯỚC ---
window.sendProfileAndMoveStep = async function(mst, lopId, emailKhach, tenCty) {
    if(!confirm("Hệ thống sẽ gửi hồ sơ mẫu đến đối tác và chuyển thẻ sang bước CHUẨN BỊ?")) return;
    try {
        const res = await fetch(GAS_URL_SYSTEM, { method: 'POST', body: JSON.stringify({ type: "send_profile_template", email: emailKhach, tenCty: tenCty }) });
        const result = await res.json();
        if (result.success) {
            await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lopId}`), { TrangThai: "B4_ChuanBi" });
            const logRef = ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lopId}/NhatKy`);
            await push(logRef, { ThoiGian: new Date().toLocaleString('vi-VN'), NoiDung: "Đã gửi hồ sơ mẫu. Tự động chuyển bước.", NguoiThucHien: auth.currentUser.email });
            loadKanbanData();
        }
    } catch(e) { alert("Lỗi: " + e.message); }
};

// ==========================================
// ĐIỀU PHỐI GIẢNG VIÊN & ĐỊNH VỊ (V1.25)
// ==========================================

async function getCoords(address) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
        const data = await res.json();
        return data.length > 0 ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
    } catch (e) { return null; }
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

window.findNearestTrainers = async function(customerAddress) {
    alert("Đang tính toán khoảng cách giảng viên...");
    const customerCoords = await getCoords(customerAddress);
    if(!customerCoords) return alert("Không định vị được địa chỉ khách hàng.");

    const snap = await get(ref(db, 'QuanLyGiangVien'));
    let list = [];
    if(snap.exists()){
        snap.forEach(c => {
            const gv = c.val();
            if(gv.coords) {
                const d = getDistance(customerCoords.lat, customerCoords.lon, gv.coords.lat, gv.coords.lon);
                list.push({...gv, distance: d.toFixed(1)});
            }
        });
    }
    list.sort((a,b) => a.distance - b.distance);
    let msg = "GIẢNG VIÊN GẦN NHẤT:\n";
    list.slice(0,3).forEach((g, i) => msg += `${i+1}. ${g.HoTen} - Cách ${g.distance} km\n`);
    alert(msg);
};

window.loadTrainers = async function() {
    const tbody = document.getElementById('trainerTableBody');
    if(!tbody) return;
    const snap = await get(ref(db, 'QuanLyGiangVien'));
    let html = '';
    if(snap.exists()) {
        snap.forEach(c => {
            const gv = c.val();
            html += `<tr><td class="p-4 font-bold">${gv.HoTen}</td><td class="p-4">${gv.DiaChi}</td><td class="p-4">${gv.NganhGiang}</td><td class="p-4 text-center">${gv.PhiNgay}</td><td class="p-4 text-center text-blue-600 underline cursor-pointer">Sửa</td></tr>`;
        });
    }
    tbody.innerHTML = html;
};

// --- HÀM TRA CỨU MST (GIỮ NGUYÊN) ---
window.autoFillData = async function() {
    const mstIn = document.getElementById('newMST');
    const tenIn = document.getElementById('newTenCTY');
    const diaIn = document.getElementById('newDiaChi');
    let mst = mstIn.value.trim();
    if(!mst) return;
    if(mst.length === 9 && !mst.startsWith('0')) { mst = '0'+mst; mstIn.value = mst; }
    try {
        const res = await fetch(GAS_URL_SYSTEM, { method: 'POST', body: JSON.stringify({ type: "lookup_mst", mst: mst }) });
        const data = await res.json();
        if(data.success) { tenIn.value = data.tenCongTy; diaIn.value = data.diaChi; }
    } catch(e) {}
};

window.setupKanbanEvents = function() {
    setTimeout(() => {
        loadKanbanData();
        const f = document.getElementById('formCreateClass');
        if(f) f.onsubmit = async (e) => {
            e.preventDefault();
            const mst = document.getElementById('newMST').value;
            const ten = document.getElementById('newTenCTY').value;
            const dia = document.getElementById('newDiaChi').value;
            const lop = document.getElementById('newLop').value;
            await update(ref(db, `KhachHang/${mst}/ThongTinGoc`), { TenCongTy: ten, DiaChi: dia, MST: mst });
            await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lop}`), { TrangThai: "B1_BaoGia", NgayTao: new Date().toLocaleDateString('vi-VN') });
            document.getElementById('modalCreate').classList.add('hidden');
            loadKanbanData();
        };
        const m = document.getElementById('newMST');
        if(m) m.onblur = autoFillData;
    }, 200);
};

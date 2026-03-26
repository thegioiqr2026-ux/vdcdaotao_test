// Phiên bản: 1.26
// Chức năng: Kanban, Tra cứu MST, Chống trùng lặp đơn hàng, Quản lý & Định vị Giảng viên

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
// LOGIC KANBAN & KIỂM TRA TRÙNG LẶP (V1.26)
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
                            <h3 class="font-bold text-gray-800 text-[11px] mb-1 uppercase line-clamp-2">${khData.ThongTinGoc?.TenCongTy || "N/A"}</h3>
                            <p class="text-[10px] text-gray-500 line-clamp-1 mb-2 italic"><i class="fa-solid fa-location-dot mr-1 text-red-400"></i>${khData.ThongTinGoc?.DiaChi || "Chưa có địa chỉ"}</p>
                            <p class="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded mb-2 border border-slate-100 line-clamp-2">${lopData.NoiDungHuanLuyen || 'Chưa nhập nội dung'}</p>
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

// --- LOGIC GỬI HỒ SƠ & CHUYỂN BƯỚC ---
window.sendProfileAndMoveStep = async function(mst, lopId, emailKhach, tenCty) {
    if(!confirm("Gửi hồ sơ mẫu và chuyển thẻ sang bước CHUẨN BỊ?")) return;
    try {
        const res = await fetch(GAS_URL_SYSTEM, { method: 'POST', body: JSON.stringify({ type: "send_profile_template", email: emailKhach, tenCty: tenCty }) });
        const result = await res.json();
        if (result.success) {
            await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lopId}`), { TrangThai: "B4_ChuanBi" });
            await push(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lopId}/NhatKy`), { 
                ThoiGian: new Date().toLocaleString('vi-VN'), 
                NoiDung: "Hệ thống: Đã gửi hồ sơ mẫu & Tự động chuyển bước.", 
                NguoiThucHien: auth.currentUser.email 
            });
            loadKanbanData();
        }
    } catch(e) { alert("Lỗi: " + e.message); }
};

// ==========================================
// HÀM QUAN TRỌNG: KIỂM TRA TRÙNG LẶP (DUPLICATION CHECK)
// ==========================================
async function checkDuplicateOrder(mst, noiDungMoi) {
    const snapshot = await get(ref(db, `KhachHang/${mst}/CacLopHuanLuyen`));
    if (snapshot.exists()) {
        const cacLop = snapshot.val();
        for (let id in cacLop) {
            // Kiểm tra nếu nội dung mới giống hệt nội dung đã tồn tại (không phân biệt hoa thường)
            if (cacLop[id].NoiDungHuanLuyen?.toLowerCase().trim() === noiDungMoi.toLowerCase().trim()) {
                return true; // Phát hiện trùng
            }
        }
    }
    return false;
}

window.submitNewClass = async function(ev) {
    ev.preventDefault();
    const btn = document.getElementById('btnSubmitCreate');
    const mst = document.getElementById('newMST').value.trim();
    const ten = document.getElementById('newTenCTY').value.trim();
    const dia = document.getElementById('newDiaChi').value.trim();
    const lop = document.getElementById('newLop').value.trim();
    const noidung = document.getElementById('newNoiDung').value.trim();

    // BƯỚC KIỂM TRA TRÙNG
    const isDuplicate = await checkDuplicateOrder(mst, noidung);
    if (isDuplicate) {
        alert(`⚠️ CẢNH BÁO TRÙNG ĐƠN:\nCông ty này đã có một lớp với nội dung tương tự: "${noidung}".\nVui lòng kiểm tra lại để tránh lên đơn trùng lặp!`);
        return; // Dừng xử lý, không cho lưu
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        await update(ref(db, `KhachHang/${mst}/ThongTinGoc`), { TenCongTy: ten, DiaChi: dia, MST: mst });
        await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lop}`), { 
            TrangThai: "B1_BaoGia", 
            NgayTao: new Date().toLocaleDateString('vi-VN'),
            NoiDungHuanLuyen: noidung
        });
        document.getElementById('modalCreate').classList.add('hidden');
        document.getElementById('formCreateClass').reset();
        loadKanbanData();
    } catch(err) { alert(err.message); }
    btn.innerHTML = 'Tạo mới';
    btn.disabled = false;
};

// ==========================================
// QUẢN LÝ GIẢNG VIÊN & ĐỊNH VỊ (V1.26)
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
    alert("Đang định vị và tính khoảng cách...");
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
    let msg = "TOP 3 GIẢNG VIÊN GẦN NHẤT:\n";
    list.slice(0,3).forEach((g, i) => msg += `${i+1}. ${g.HoTen} (${g.distance} km)\n`);
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
            html += `<tr class="border-b hover:bg-slate-50"><td class="p-4 font-bold text-blue-700">${gv.HoTen}</td><td class="p-4 text-xs">${gv.DiaChi}</td><td class="p-4">${gv.NganhGiang}</td><td class="p-4 text-center">${gv.PhiNgay}</td><td class="p-4 text-center font-bold text-amber-600">${gv.DiemUuTien}/10</td></tr>`;
        });
    }
    tbody.innerHTML = html;
};

// --- TRA CỨU MST ---
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
        if(f) f.addEventListener('submit', submitNewClass);
        const m = document.getElementById('newMST');
        if(m) m.onblur = autoFillData;
    }, 200);
};

// --- QUẢN LÝ TÀI KHOẢN ---
window.loadAdminUsers = async function() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    const snapshot = await get(child(ref(db), `AccessControl`));
    if (snapshot.exists()) {
        let html = '';
        snapshot.forEach((snap) => {
            const d = snap.val();
            html += `<tr class="border-b"><td class="p-4 font-medium">${d.HoTen}</td><td class="p-4">${d.Email}</td><td class="p-4 text-center">${d.Role}</td><td class="p-4 text-center">${d.TrangThai}</td><td class="p-4 text-center"><button class="text-blue-600 underline">Sửa</button></td></tr>`;
        });
        tbody.innerHTML = html;
    }
};

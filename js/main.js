// Phiên bản: 1.27
// Chức năng: Kanban, Chống trùng lặp, Admin xóa đơn, Quản lý Giảng viên hoàn thiện

import { auth, db, onAuthStateChanged, signOut, ref, get, child, update, push } from './firebase-config.js';

const GAS_URL_SYSTEM = "https://script.google.com/macros/s/AKfycbxRNpGczbDYLXpJliEOHhcubc41qm-x7DW47MsVz1W6Ne3BJTMWYs98ciWE5SkY2MWY/exec";

// Lưu biến toàn cục để check quyền Admin
window.currentUserRole = 'NhanVien'; 

onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.replace('login.html'); } 
    else { document.getElementById('appBody').classList.remove('hidden'); initApp(user); }
});

async function loadComponent(id, file) {
    try {
        // Thêm timestamp vào đuôi URL để ép trình duyệt luôn tải file mới nhất (Bypass Cache)
        const noCacheUrl = file + '?v=' + new Date().getTime(); 
        const response = await fetch(noCacheUrl);
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
    
    // Kiểm tra quyền Admin
    const safeEmail = user.email.replace(/\./g, '_');
    const roleSnapshot = await get(child(ref(db), `AccessControl/${safeEmail}/Role`));
    window.currentUserRole = roleSnapshot.exists() ? roleSnapshot.val() : 'NhanVien';
    
    const adminMenu = document.getElementById('menuAdminUsers');
    if (adminMenu && window.currentUserRole === 'Admin') adminMenu.classList.remove('hidden');

    // Chức năng đăng xuất
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.onclick = async () => { await signOut(auth); window.location.replace('login.html'); };

    loadView('views/kanban.html');
}

window.loadView = async function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    contentDiv.innerHTML = `<div class="flex items-center justify-center h-full"><i class="fa-solid fa-spinner fa-spin text-3xl text-blue-500"></i></div>`;
    await loadComponent("layout-content", viewFile);
    
    if (viewFile === 'views/kanban.html') setupKanbanEvents();
    if (viewFile === 'views/admin-users.html') loadAdminUsers();
    if (viewFile === 'views/admin-trainers.html') setupTrainerEvents();
};

// ==========================================
// LOGIC KANBAN & ADMIN XÓA ĐƠN (V1.27)
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
                    
                    // Nút xóa chỉ hiện cho Admin
                    const deleteBtn = window.currentUserRole === 'Admin' ? `<button onclick="deleteOrder('${mst}', '${lopId}')" class="absolute top-2 right-2 text-red-300 hover:text-red-600 transition-colors" title="Xóa đơn này"><i class="fa-solid fa-trash-can"></i></button>` : '';

                    const cardHTML = `
                        <div class="relative bg-white p-3.5 rounded-lg shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-blue-400 transition-all mb-3" 
                             draggable="true" ondragstart="dragCard(event, '${mst}', '${lopId}')">
                            ${deleteBtn}
                            <div class="flex justify-between items-start mb-1 pr-6">
                                <span class="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">${mst}</span>
                                <span class="text-[9px] text-gray-400">${lopId}</span>
                            </div>
                            <h3 class="font-bold text-gray-800 text-[11px] mb-1 uppercase line-clamp-2 pr-4">${khData.ThongTinGoc?.TenCongTy || "N/A"}</h3>
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

// --- ADMIN XÓA ĐƠN ---
window.deleteOrder = async function(mst, lopId) {
    if(!confirm(`⚠️ CHÚ Ý: Bạn có chắc chắn muốn xóa vĩnh viễn đơn hàng [${lopId}] không?`)) return;
    try {
        // Dùng update null để xóa node con trong Firebase
        await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen`), { [lopId]: null });
        loadKanbanData();
    } catch(err) { alert("Lỗi khi xóa: " + err.message); }
};

window.sendProfileAndMoveStep = async function(mst, lopId, emailKhach, tenCty) {
    if(!confirm("Gửi hồ sơ mẫu và chuyển thẻ sang bước CHUẨN BỊ?")) return;
    try {
        const res = await fetch(GAS_URL_SYSTEM, { method: 'POST', body: JSON.stringify({ type: "send_profile_template", email: emailKhach, tenCty: tenCty }) });
        const result = await res.json();
        if (result.success) {
            await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lopId}`), { TrangThai: "B4_ChuanBi" });
            loadKanbanData();
        }
    } catch(e) { alert("Lỗi: " + e.message); }
};

async function checkDuplicateOrder(mst, noiDungMoi) {
    const snapshot = await get(ref(db, `KhachHang/${mst}/CacLopHuanLuyen`));
    if (snapshot.exists()) {
        const cacLop = snapshot.val();
        for (let id in cacLop) {
            if (cacLop[id].NoiDungHuanLuyen?.toLowerCase().trim() === noiDungMoi.toLowerCase().trim()) {
                return true;
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

    const isDuplicate = await checkDuplicateOrder(mst, noidung);
    if (isDuplicate) {
        alert(`⚠️ CẢNH BÁO: Công ty này đã có lớp với nội dung: "${noidung}". Tránh lên đơn trùng lặp!`);
        return;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;

    try {
        await update(ref(db, `KhachHang/${mst}/ThongTinGoc`), { TenCongTy: ten, DiaChi: dia, MST: mst });
        await update(ref(db, `KhachHang/${mst}/CacLopHuanLuyen/${lop}`), { 
            TrangThai: "B1_BaoGia", NgayTao: new Date().toLocaleDateString('vi-VN'), NoiDungHuanLuyen: noidung
        });
        document.getElementById('modalCreate').classList.add('hidden');
        document.getElementById('formCreateClass').reset();
        loadKanbanData();
    } catch(err) { alert(err.message); }
    btn.innerHTML = 'Tạo mới'; btn.disabled = false;
};

// ==========================================
// QUẢN LÝ GIẢNG VIÊN HOÀN THIỆN (V1.27)
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

// Bắt sự kiện form Giảng viên
window.setupTrainerEvents = function() {
    setTimeout(() => {
        loadTrainers();
        const f = document.getElementById('formTrainer');
        if(f) f.addEventListener('submit', saveTrainer);
    }, 200);
};

// Hàm lưu Giảng viên lên Firebase
window.saveTrainer = async function(ev) {
    ev.preventDefault();
    const btn = ev.target.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;

    const ten = document.getElementById('gvTen').value;
    const sdt = document.getElementById('gvSdt').value;
    const diachi = document.getElementById('gvDiaChi').value;
    const nganh = document.getElementById('gvNganh').value;
    const phi = document.getElementById('gvPhiNgay').value;
    const diem = document.getElementById('gvDiem').value;

    const coords = await getCoords(diachi); // Tự định vị tọa độ

    try {
        await push(ref(db, 'QuanLyGiangVien'), {
            HoTen: ten, Sdt: sdt, DiaChi: diachi, NganhGiang: nganh, 
            PhiNgay: phi, DiemUuTien: diem, coords: coords
        });
        document.getElementById('modalTrainer').classList.add('hidden');
        ev.target.reset();
        loadTrainers();
    } catch (e) { alert("Lỗi lưu giảng viên: " + e.message); }
    
    btn.innerHTML = 'Lưu hồ sơ'; btn.disabled = false;
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

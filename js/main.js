// Phiên bản: 1.32
// Chức năng: ĐẦY ĐỦ (Kanban, Giảng Viên, Phân Quyền, Fix Cache, Đổi Mật Khẩu)

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
        // 1. KIỂM TRA TRẠNG THÁI TÀI KHOẢN
        const safeEmail = user.email.replace(/\./g, '_');
        const userRef = ref(db, `AccessControl/${safeEmail}`);
        const snap = await get(userRef);

        if (!snap.exists()) {
            await update(userRef, { Email: user.email, Role: 'NhanVien', TrangThai: 'Locked' });
            alert("Tài khoản mới đăng ký. Vui lòng chờ Admin phê duyệt để có thể truy cập hệ thống!");
            await signOut(auth);
            window.location.replace('login.html');
            return;
        } else {
            const data = snap.val();
            window.currentUserRole = data.Role || 'NhanVien';
            if (data.TrangThai !== 'Active' && data.Role !== 'Admin') {
                alert("Tài khoản của bạn đang bị khóa hoặc chưa được phê duyệt!");
                await signOut(auth);
                window.location.replace('login.html');
                return;
            }
        }

        document.getElementById('appBody').classList.remove('hidden'); 
        initApp(user); 
    }
});

async function initApp(user) {
    await loadComponent("layout-sidebar", "components/sidebar.html");
    await loadComponent("layout-header", "components/header.html");
    await loadComponent("layout-footer", "components/footer.html");

    const userDisplay = document.getElementById('userEmailDisplay');
    if (userDisplay) userDisplay.textContent = user.email;
    
    const adminMenu = document.getElementById('menuAdminUsers');
    if (adminMenu && window.currentUserRole === 'Admin') adminMenu.classList.remove('hidden');

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.stopPropagation(); 
            if(confirm("Bạn muốn đăng xuất khỏi hệ thống?")) {
                await signOut(auth); 
                window.location.replace('login.html');
            }
        });
    }

    loadView('views/kanban.html');
}

// Phiên bản: 3.2 - Fix lỗi nạp module Thông tin học viên

window.loadView = async function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    const timestamp = new Date().getTime();

    // Hiển thị loading nhẹ trong khi nạp
    contentDiv.innerHTML = `<div class="flex items-center justify-center h-full text-blue-500"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;

    // CHẾ ĐỘ NHÚNG IFRAME (Dành cho các module xử lý dữ liệu phức tạp)
    // Giúp tránh lỗi "quay quay" do xung đột mã module
    if (viewFile === 'printdoc.html' || viewFile === 'views/loadExcel.html') {
        contentDiv.innerHTML = `
            <iframe src="${viewFile}?v=${timestamp}" 
                    class="w-full h-full border-none shadow-inner" 
                    style="min-height: 88vh; background: white; border-radius: 8px;">
            </iframe>`;
        return;
    }

    // CHẾ ĐỘ NẠP COMPONENT (Dành cho Kanban, Admin, Profile...)
    await loadComponent("layout-content", viewFile);
    
    // Kích hoạt logic sau khi nạp
    if (viewFile === 'views/kanban.html') setupKanbanEvents();
    if (viewFile === 'views/admin-users.html') loadAdminUsers();
    if (viewFile === 'views/admin-trainers.html') setupTrainerEvents();
    if (viewFile === 'views/profile.html') setupProfileEvents();
};

// ==========================================
// HỒ SƠ & ĐỔI MẬT KHẨU
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
                    alert("Lỗi: " + error.message);
                }
            };
        }
    }, 200);
};

// ==========================================
// QUẢN LÝ TÀI KHOẢN & ADMIN MỞ KHÓA
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
        loadAdminUsers(); 
    } catch (e) { alert("Lỗi phân quyền: " + e.message); }
};

// ==========================================
// LOGIC KANBAN CHÍNH
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

window.deleteOrder = async function(mst, lopId) {
    if(!confirm(`⚠️ CHÚ Ý: Bạn có chắc chắn muốn xóa vĩnh viễn đơn hàng [${lopId}] không?`)) return;
    try {
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
// QUẢN LÝ GIẢNG VIÊN & ĐỊNH VỊ
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

window.setupTrainerEvents = function() {
    setTimeout(() => {
        loadTrainers();
        const f = document.getElementById('formTrainer');
        if(f) f.addEventListener('submit', saveTrainer);
    }, 200);
};

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

    const coords = await getCoords(diachi); 

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

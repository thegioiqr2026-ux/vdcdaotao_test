// Phiên bản: 1.23
// Chức năng: Kanban, Tra cứu MST/Địa chỉ, Gửi hồ sơ mẫu & Tự động nhảy bước, Nhật ký Timeline
import { auth, db, onAuthStateChanged, signOut, ref, get, child, update, push } from './firebase-config.js';

// THAY LINK WEB APP GAS CỦA ANH VÀO ĐÂY
const GAS_URL = "https://script.google.com/macros/s/AKfycbxRNpGczbDYLXpJliEOHhcubc41qm-x7DW47MsVz1W6Ne3BJTMWYs98ciWE5SkY2MWY/exec";

// Biến tạm lưu trữ thông tin thẻ đang chọn
let currentSelectedCard = { mst: '', lopId: '', email: '', tenCty: '' };

// ==========================================
// 1. KHỞI TẠO HỆ THỐNG & PHÂN QUYỀN
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace('login.html'); 
    } else {
        const appBody = document.getElementById('appBody');
        if(appBody) appBody.classList.remove('hidden'); 
        initApp(user);
    }
});

async function loadComponent(id, file) {
    try {
        const response = await fetch(file);
        if (response.ok) {
            document.getElementById(id).innerHTML = await response.text();
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
    try {
        const roleSnapshot = await get(child(ref(db), `AccessControl/${safeEmail}/Role`));
        const userRole = roleSnapshot.exists() ? roleSnapshot.val() : 'NhanVien';
        const adminMenu = document.getElementById('menuAdminUsers');
        if (adminMenu && userRole === 'Admin') {
            adminMenu.classList.remove('hidden');
            adminMenu.classList.add('flex');
        }
    } catch (err) { console.error("Lỗi phân quyền:", err); }
    
    loadView('views/kanban.html');
}

// Điều hướng View
window.loadView = async function(viewFile) {
    const contentDiv = document.getElementById('layout-content');
    contentDiv.innerHTML = `<div class="flex items-center justify-center h-full"><i class="fa-solid fa-spinner fa-spin text-3xl text-blue-500"></i></div>`;
    
    await loadComponent("layout-content", viewFile);
    
    if (viewFile === 'views/kanban.html') {
        setupKanbanEvents();
    } else if (viewFile === 'views/admin-users.html') {
        loadAdminUsers();
    }
};

// ==========================================
// 2. LOGIC TRA CỨU & TẠO ĐƠN MỚI
// ==========================================
window.autoFillData = async function() {
    const mstIn = document.getElementById('newMST');
    const tenIn = document.getElementById('newTenCTY');
    const dcIn = document.getElementById('newDiaChi');
    const lopIn = document.getElementById('newLop');
    
    let mst = mstIn.value.trim();
    if (!mst) return;
    if (mst.length === 9 && !mst.startsWith('0')) { mst = '0' + mst; mstIn.value = mst; }

    try {
        const snap = await get(child(ref(db), `KhachHang/${mst}/ThongTinGoc`));
        let fName = "", fAddr = "";
        if (snap.exists()) {
            fName = snap.val().TenCongTy;
            fAddr = snap.val().DiaChi || "";
        } else {
            tenIn.placeholder = "Đang tra cứu...";
            const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ type: "lookup_mst", mst: mst }) });
            const result = await res.json();
            if (result.success) { fName = result.tenCongTy; fAddr = result.diaChi; }
            tenIn.placeholder = "";
        }
        if (fName) tenIn.value = fName;
        if (fAddr) dcIn.value = fAddr;

        // Sinh mã lớp
        const year = new Date().getFullYear();
        const snapLop = await get(child(ref(db), `KhachHang/${mst}/CacLopHuanLuyen`));
        let stt = 1;
        if (snapLop.exists()) {
            const keys = Object.keys(snapLop.val());
            const filtered = keys.filter(k => k.startsWith(`${mst}-${year}-`));
            if (filtered.length > 0) stt = Math.max(...filtered.map(k => parseInt(k.split('-').pop()))) + 1;
        }
        lopIn.value = `${mst}-${year}-${stt}`;
    } catch (e) { console.error(e); }
};

window.submitNewClass = async function(ev) {
    ev.preventDefault();
    const btn = document.getElementById('btnSubmitCreate');
    btn.disabled = true;

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
    btn.disabled = false;
};

// ==========================================
// 3. LOGIC KANBAN & CHI TIẾT
// ==========================================
window.loadKanbanData = async function() {
    const cols = ['B1_BaoGia', 'B4_ChuanBi', 'B5_DangDay', 'B6_ChoInPhoi', 'B7_HoanTat'];
    cols.forEach(c => { if(document.getElementById('col_' + c)) document.getElementById('col_' + c).innerHTML = ''; });

    const snapshot = await get(ref(db, 'KhachHang'));
    if (snapshot.exists()) {
        snapshot.forEach(khSnap => {
            const mst = khSnap.key;
            const khData = khSnap.val();
            if (khData.CacLopHuanLuyen) {
                Object.keys(khData.CacLopHuanLuyen).forEach(lopId => {
                    const lop = khData.CacLopHuanLuyen[lopId];
                    const cardHTML = `
                        <div class="bg-white p-3 rounded shadow-sm border mb-2 cursor-pointer hover:border-blue-500 transition-all group" 
                             onclick="showDetail('${mst}', '${lopId}')">
                            <div class="flex justify-between text-[9px] mb-1">
                                <span class="font-bold text-blue-600">${mst}</span>
                                <span class="text-gray-400 font-mono">${lopId}</span>
                            </div>
                            <h3 class="font-bold text-xs line-clamp-2 text-slate-800">${khData.ThongTinGoc.TenCongTy}</h3>
                            <p class="text-[10px] text-gray-400 mt-1 italic line-clamp-1"><i class="fa-solid fa-location-dot mr-1"></i>${khData.ThongTinGoc.DiaChi || 'N/A'}</p>
                        </div>`;
                    const col = document.getElementById('col_' + (lop.TrangThai || 'B1_BaoGia'));
                    if(col) col.insertAdjacentHTML('beforeend', cardHTML);
                });
            }
        });
    }
};

// Hiển thị Modal chi tiết & Nhật ký
window.showDetail = async function(mst, lopId) {
    const snap = await get(ref(db, `KhachHang/${mst}`));
    if (!snap.exists()) return;
    
    const kh = snap.val();
    const lop = kh.CacLopHuanLuyen[lopId];
    currentSelectedCard = { mst, lopId, tenCty: kh.ThongTinGoc.TenCongTy, email: '' };

    document.getElementById('detTenCty').textContent = kh.ThongTinGoc.TenCongTy;
    document.getElementById('detMST').textContent = `MST: ${mst} | LỚP: ${lopId}`;
    document.getElementById('detDiaChi').textContent = kh.ThongTinGoc.DiaChi || 'Chưa có địa chỉ';
    document.getElementById('detNoiDung').textContent = lop.NoiDungHuanLuyen || 'Chưa nhập nội dung';
    
    const timeline = document.getElementById('timelineList');
    timeline.innerHTML = '';
    if (lop.NhatKy) {
        Object.values(lop.NhatKy).reverse().forEach(log => {
            timeline.insertAdjacentHTML('beforeend', `
                <div class="border-l-2 border-blue-100 pl-3 pb-3 relative">
                    <div class="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-blue-400"></div>
                    <p class="text-[9px] font-bold text-blue-500">${log.ThoiGian}</p>
                    <p class="text-xs text-slate-700 font-medium">${log.NoiDung}</p>
                    <p class="text-[9px] text-slate-400 italic">Thực hiện: ${log.NguoiThucHien}</p>
                </div>`);
        });
    } else {
        timeline.innerHTML = '<p class="text-xs text-slate-400 italic px-2">Chưa có hoạt động nào.</p>';
    }
    document.getElementById('modalDetail').classList.remove('hidden');
};

// Gửi hồ sơ mẫu & Tự động nhảy bước
window.handleSendProfile = async function() {
    const email = prompt("Nhập Email nhận hồ sơ mẫu:", "");
    if (!email) return;

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ type: "send_profile_template", email: email, tenCty: currentSelectedCard.tenCty })
        });
        const result = await res.json();

        if (result.success) {
            const now = new Date().toLocaleString('vi-VN');
            // Ghi log & Chuyển bước
            await push(ref(db, `KhachHang/${currentSelectedCard.mst}/CacLopHuanLuyen/${currentSelectedCard.lopId}/NhatKy`), {
                ThoiGian: now,
                NoiDung: `Hệ thống: Đã gửi hồ sơ mẫu đến ${email}. Tự động chuyển B1 -> B4.`,
                NguoiThucHien: auth.currentUser.email
            });
            await update(ref(db, `KhachHang/${currentSelectedCard.mst}/CacLopHuanLuyen/${currentSelectedCard.lopId}`), { TrangThai: "B4_ChuanBi" });
            
            alert("Gửi thành công! Thẻ đã chuyển sang bước Chuẩn bị.");
            document.getElementById('modalDetail').classList.add('hidden');
            loadKanbanData();
        }
    } catch (e) { alert("Lỗi: " + e.message); }
    btn.disabled = false;
    btn.innerHTML = originalText;
};

// Cài đặt sự kiện Kanban
window.setupKanbanEvents = function() {
    setTimeout(() => {
        loadKanbanData();
        const form = document.getElementById('formCreateClass');
        if(form) form.addEventListener('submit', submitNewClass);
        const mstIn = document.getElementById('newMST');
        if(mstIn) mstIn.addEventListener('blur', autoFillData);
    }, 300);
};

// Cập nhật hàm In Báo Giá thực tế (V1.24 - Dự án vdcdaotao-test)
window.printQuote = function() {
    // 1. Kiểm tra xem đã chọn thẻ nào chưa
    if (!currentSelectedCard.mst) {
        alert("Không tìm thấy dữ liệu thẻ!");
        return;
    }

    // 2. Lấy thông tin từ giao diện Modal chi tiết
    const mst = currentSelectedCard.mst;
    const lopId = currentSelectedCard.lopId;
    const tenCty = currentSelectedCard.tenCty;
    const diaChi = document.getElementById('detDiaChi').textContent;
    const noiDung = document.getElementById('detNoiDung').textContent;

    // 3. Hỏi nhanh thông số để tính tiền
    const slHocVien = prompt("Nhập số lượng học viên:", "20");
    if (slHocVien === null) return; 
    
    const phiDiChuyen = prompt("Nhập phí di chuyển & lưu trú (VNĐ):", "500000");
    if (phiDiChuyen === null) return;

    // 4. Tạo link truyền dữ liệu sang trang print-quote.html
    const params = new URLSearchParams({
        mst: mst,
        ten: tenCty,
        dc: diaChi,
        nd: noiDung,
        sl: slHocVien,
        pdc: phiDiChuyen,
        id: lopId
    });

    // 5. Mở trang in trong tab mới
    window.open(`views/print-quote.html?${params.toString()}`, '_blank');
};

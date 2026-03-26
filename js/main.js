// js/main.js - V1.23
import { auth, db, onAuthStateChanged, signOut, ref, get, child, update, push } from './firebase-config.js';

const GAS_URL = "https://script.google.com/macros/s/AKfycbxRNpGczbDYLXpJliEOHhcubc41qm-x7DW47MsVz1W6Ne3BJTMWYs98ciWE5SkY2MWY/exec";

// --- QUẢN LÝ TRẠNG THÁI TẠM THỜI ---
let currentSelectedCard = { mst: '', lopId: '', email: '', tenCty: '' };

// --- LOGIC GỬI HỒ SƠ & TỰ ĐỘNG CHUYỂN BƯỚC ---
window.handleSendProfile = async function() {
    const email = prompt("Nhập Email khách hàng để nhận hồ sơ mẫu:", currentSelectedCard.email || "");
    if (!email) return;

    const btn = event.target;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: "send_profile_template", 
                email: email, 
                tenCty: currentSelectedCard.tenCty 
            })
        });
        const result = await res.json();

        if (result.success) {
            const now = new Date().toLocaleString('vi-VN');
            // 1. Ghi Nhật ký tự động
            const logRef = ref(db, `KhachHang/${currentSelectedCard.mst}/CacLopHuanLuyen/${currentSelectedCard.lopId}/NhatKy`);
            await push(logRef, {
                ThoiGian: now,
                NoiDung: `Hệ thống: Đã gửi bộ hồ sơ mẫu & hướng dẫn đến ${email}.`,
                NguoiThucHien: auth.currentUser.email
            });

            // 2. Chuyển trạng thái Kanban B1 -> B4
            await update(ref(db, `KhachHang/${currentSelectedCard.mst}/CacLopHuanLuyen/${currentSelectedCard.lopId}`), { 
                TrangThai: "B4_ChuanBi" 
            });

            alert("Gửi thành công! Thẻ đã được chuyển sang mục Chuẩn bị.");
            document.getElementById('modalDetail').classList.add('hidden');
            loadKanbanData();
        }
    } catch (e) { alert("Lỗi gửi mail: " + e.message); }
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-envelope-open-text mr-2"></i> Gửi Hồ Sơ Mẫu & Chốt';
};

// --- HIỂN THỊ CHI TIẾT & NHẬT KÝ ---
window.showDetail = async function(mst, lopId) {
    const snap = await get(ref(db, `KhachHang/${mst}`));
    if (!snap.exists()) return;
    
    const kh = snap.val();
    const lop = kh.CacLopHuanLuyen[lopId];
    
    currentSelectedCard = { mst, lopId, tenCty: kh.ThongTinGoc.TenCongTy, email: '' };

    // Fill UI
    document.getElementById('detTenCty').textContent = kh.ThongTinGoc.TenCongTy;
    document.getElementById('detMST').textContent = "MST: " + mst + " | MÃ LỚP: " + lopId;
    document.getElementById('detDiaChi').textContent = kh.ThongTinGoc.DiaChi || 'Chưa cập nhật';
    document.getElementById('detNoiDung').textContent = lop.NoiDungHuanLuyen || 'N/A';
    
    // Render Nhật ký
    const timeline = document.getElementById('timelineList');
    timeline.innerHTML = '';
    if (lop.NhatKy) {
        Object.values(lop.NhatKy).reverse().forEach(log => {
            timeline.insertAdjacentHTML('beforeend', `
                <div class="relative pb-2">
                    <p class="text-[10px] font-bold text-blue-500">${log.ThoiGian}</p>
                    <p class="text-xs text-slate-700 leading-snug">${log.NoiDung}</p>
                    <p class="text-[9px] text-slate-400 italic">Bởi: ${log.NguoiThucHien}</p>
                </div>
            `);
        });
    } else {
        timeline.innerHTML = '<p class="text-xs text-slate-400 italic">Chưa có nhật ký trao đổi.</p>';
    }

    document.getElementById('modalDetail').classList.remove('hidden');
};

// (Các hàm autoFillData, loadKanbanData, submitNewClass giữ nguyên từ V1.21 nhưng thay URL GAS mới)
// ... (Code tra cứu MST giống bản V1.21 anh đang có) ...

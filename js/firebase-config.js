// Phiên bản: 1.23
// Cấu hình kết nối Firebase Tập trung cho Hệ thống VDC
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, child, update, set, push, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Cấu hình Firebase của anh Công Đẹp
const firebaseConfig = { 
    apiKey: "AIzaSyCzWjfcD5Dgq7V-i2izb9tKLR6QM6qWPQo", 
    authDomain: "tavietnam-78ae8.firebaseapp.com", 
    projectId: "tavietnam-78ae8", 
    storageBucket: "tavietnam-78ae8.firebasestorage.app", 
    messagingSenderId: "670121705534", 
    appId: "1:670121705534:web:1027ad98550573ad37116f" 
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Xuất các biến và hàm cần thiết để các file JS khác sử dụng
export { 
    auth, 
    db, 
    // Các hàm Authentication
    onAuthStateChanged, 
    signOut, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    // Các hàm Realtime Database
    ref, 
    get, 
    child, 
    update, 
    set, 
    push, // Quan trọng: Dùng để tạo Nhật ký Timeline
    remove 
};

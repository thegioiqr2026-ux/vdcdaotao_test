// Phiên bản: 1.23
// Cấu hình Firebase tập trung cho dự án VDC
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, child, update, set, push, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Thông số cấu hình Firebase của anh
const firebaseConfig = { 
    apiKey: "AIzaSyCzWjfcD5Dgq7V-i2izb9tKLR6QM6qWPQo", 
    authDomain: "tavietnam-78ae8.firebaseapp.com", 
    projectId: "tavietnam-78ae8", 
    storageBucket: "tavietnam-78ae8.firebasestorage.app", 
    messagingSenderId: "670121705534", 
    appId: "1:670121705534:web:1027ad98550573ad37116f" 
};

// Khởi tạo các dịch vụ
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Xuất bản (Export) các hàm để file main.js có thể sử dụng
export { 
    auth, 
    db, 
    // Các hàm xác thực (Authentication)
    onAuthStateChanged, 
    signOut, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    // Các hàm dữ liệu (Realtime Database)
    ref, 
    get, 
    child, 
    update, 
    set, 
    push, // Hàm này bắt buộc phải có để chạy Nhật ký Timeline
    remove 
};

// Phiên bản: 1.24
// Dự án: vdcdaotao-test (Bản chuẩn)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, get, child, update, set, push, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Cấu hình Firebase vdcdaotao-test
const firebaseConfig = {
  apiKey: "AIzaSyALs7Rj4nJSkckG5isxO2mTD44iO-MGnqQ",
  authDomain: "vdcdaotao-test.firebaseapp.com",
  projectId: "vdcdaotao-test",
  storageBucket: "vdcdaotao-test.firebasestorage.app",
  messagingSenderId: "856216960118",
  appId: "1:856216960118:web:6c2f9731ab13e686f1f357",
  measurementId: "G-6FKBY8V855"
};

// Khởi tạo các dịch vụ
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Xuất bản các hàm để sử dụng toàn hệ thống
export { 
    auth, 
    db, 
    onAuthStateChanged, 
    signOut, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    ref, 
    get, 
    child, 
    update, 
    set, 
    push, 
    remove 
};

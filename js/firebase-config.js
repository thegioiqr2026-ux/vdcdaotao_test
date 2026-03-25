// Phiên bản: 1.5
// Cấu hình Firebase cho dự án TEST (vdcdaotao-test)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, set, get, child, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyALs7Rj4nJSkckG5isxO2mTD44iO-MGnqQ",
  authDomain: "vdcdaotao-test.firebaseapp.com",
  databaseURL: "https://vdcdaotao-test-default-rtdb.firebaseio.com", 
  projectId: "vdcdaotao-test",
  storageBucket: "vdcdaotao-test.firebasestorage.app",
  messagingSenderId: "856216960118",
  appId: "1:856216960118:web:6c2f9731ab13e686f1f357",
  measurementId: "G-6FKBY8V855"
};

// Khởi tạo ứng dụng
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// Xuất các hàm cần thiết để các file HTML khác sử dụng
export { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail, 
    onAuthStateChanged, 
    signOut, 
    ref, set, get, child, update 
};

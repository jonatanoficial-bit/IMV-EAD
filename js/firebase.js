// js/firebase.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// ✅ CONFIG REAL (IMVAPP-AEF54) — a mesma do seu print do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCSOuLs1PVG4eGn0NSNZxksJP8IqIdURrE",
  authDomain: "imvapp-aef54.firebaseapp.com",
  projectId: "imvapp-aef54",
  storageBucket: "imvapp-aef54.firebasestorage.app",
  messagingSenderId: "439661516200",
  appId: "1:439661516200:web:2d3ede20edbb9aa6d6f99d",
  measurementId: "G-2LEK7QDZ48"
};

// ✅ evita inicializar 2x (causa bug/piscando)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("🔥 Firebase OK:", app.name, firebaseConfig.projectId);
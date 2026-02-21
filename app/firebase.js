import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAI2Xn2CbfE9m78n8uDGzccr9mron0scaI",
  authDomain: "giltianappsmobile.firebaseapp.com",
  projectId: "giltianappsmobile",
  storageBucket: "giltianappsmobile.firebasestorage.app",
  messagingSenderId: "611921553199",
  appId: "1:611921553199:web:319a304afc1f1e903e63da",

  // 🔥 IMPORTANT — FIX REGION WARNING
  databaseURL: "https://giltianappsmobile-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);

// Firestore
export const db = getFirestore(app);

// Authentication
export const auth = getAuth(app);

// Storage
export const storage = getStorage(app);

// Realtime Database (Presence System)
export const rtdb = getDatabase(app);

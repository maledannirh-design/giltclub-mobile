import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


const firebaseConfig = {
    apiKey: "AIzaSyAI2Xn2CbfE9m78n8uDGzccr9mron0scaI",
    authDomain: "giltianappsmobile.firebaseapp.com",
    projectId: "giltianappsmobile",
    storageBucket: "giltianappsmobile.firebasestorage.app",
    messagingSenderId: "611921553199",
    appId: "1:611921553199:web:319a304afc1f1e903e63da"
  };

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

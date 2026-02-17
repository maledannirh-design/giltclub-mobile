// ===============================
// FIREBASE CORE (Single Init)
// ===============================

import { initializeApp } 
from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";

import { 
  getDatabase, 
  ref, 
  set, 
  remove, 
  onDisconnect,
  onValue,
  get,
  push
} 
from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";


// ===============================
// CONFIG
// ===============================

const firebaseConfig = {
  apiKey: "AIzaSyCCl9nA3a4drx9RKTHDUEf6uHM30JszRGc",
  authDomain: "gilt-club-cinema.firebaseapp.com",
  databaseURL: "https://gilt-club-cinema-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gilt-club-cinema",
  storageBucket: "gilt-club-cinema.firebasestorage.app",
  messagingSenderId: "957745588991",
  appId: "1:957745588991:web:b55f8e5177b92aa7e37aca"
};


// ===============================
// INIT
// ===============================

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);


// ===============================
// EXPORT (SINGLE SOURCE)
// ===============================

export {
  db,
  ref,
  set,
  remove,
  onDisconnect,
  onValue,
  get,
  push
};

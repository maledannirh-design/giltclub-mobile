// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCl9nA3a4drx9RKTHDUEf6uHM30JszRGc",
  authDomain: "gilt-club-cinema.firebaseapp.com",
  databaseURL: "https://gilt-club-cinema-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gilt-club-cinema",
  storageBucket: "gilt-club-cinema.firebasestorage.app",
  messagingSenderId: "957745588991",
  appId: "1:957745588991:web:b55f8e5177b92aa7e37aca"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

import { ref, set } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

const testRef = ref(db, "test_connection");
set(testRef, {
  status: "connected",
  timestamp: Date.now()
});


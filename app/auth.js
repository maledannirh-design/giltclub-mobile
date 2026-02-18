import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function register(email, password, username) {

  const userCredential =
    await createUserWithEmailAndPassword(auth, email, password);

  const user = userCredential.user;

  await setDoc(doc(db, "users", user.uid), {
    name: username,
    username: username.toLowerCase(),
    membership: "MEMBER",
    level: 1,
    points: 0,
    wins: 0,
    matches: 0,
    followersCount: 0,
    followingCount: 0,
    attendanceCount: 0,
    isPublic: true,
    createdAt: new Date()
  });
}

export async function login(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

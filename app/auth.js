import { db } from "./firebase.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function createTestUser(){

  const userId = "test_user_1";

  await setDoc(doc(db, "users", userId), {
    name: "Test User",
    username: "testuser",
    membership: "MEMBER",
    level: 1,
    points: 0,
    wins: 0,
    matches: 0,
    followersCount: 0,
    followingCount: 0,
    isPublic: true,
    createdAt: new Date()
  });

  console.log("User created!");
}

export async function readTestUser(){

  const snap = await getDoc(doc(db, "users", "test_user_1"));

  if(snap.exists()){
    console.log("User data:", snap.data());
  } else {
    console.log("User not found");
  }
}

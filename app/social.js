import { auth, db } from "./firebase.js";
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function followUser(targetUserId) {

  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const myId = currentUser.uid;

  if (myId === targetUserId) return;

  await setDoc(doc(db, "users", targetUserId, "followers", myId), {
    followedAt: new Date()
  });

  await setDoc(doc(db, "users", myId, "following", targetUserId), {
    followedAt: new Date()
  });

  await updateDoc(doc(db, "users", targetUserId), {
    followersCount: increment(1)
  });

  await updateDoc(doc(db, "users", myId), {
    followingCount: increment(1)
  });

  console.log("Follow success");
}

export async function unfollowUser(targetUserId) {

  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const myId = currentUser.uid;

  await deleteDoc(doc(db, "users", targetUserId, "followers", myId));
  await deleteDoc(doc(db, "users", myId, "following", targetUserId));

  await updateDoc(doc(db, "users", targetUserId), {
    followersCount: increment(-1)
  });

  await updateDoc(doc(db, "users", myId), {
    followingCount: increment(-1)
  });

  console.log("Unfollow success");
}

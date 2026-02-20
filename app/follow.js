import { auth, db } from "./firebase.js";
import {
  doc,
  runTransaction,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function toggleFollow(targetUserId) {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const currentUserId = currentUser.uid;

  if (currentUserId === targetUserId) return;

  const currentUserRef = doc(db, "users", currentUserId);
  const targetUserRef = doc(db, "users", targetUserId);

  const followingRef = doc(db, "users", currentUserId, "following", targetUserId);
  const followerRef = doc(db, "users", targetUserId, "followers", currentUserId);

  try {
    await runTransaction(db, async (transaction) => {

      const followingDoc = await transaction.get(followingRef);

      if (followingDoc.exists()) {
        // ===== UNFOLLOW =====
        transaction.delete(followingRef);
        transaction.delete(followerRef);

        transaction.update(currentUserRef, {
          followingCount: increment(-1)
        });

        transaction.update(targetUserRef, {
          followersCount: increment(-1)
        });

      } else {
        // ===== FOLLOW =====
        transaction.set(followingRef, {
          createdAt: serverTimestamp()
        });

        transaction.set(followerRef, {
          createdAt: serverTimestamp()
        });

        transaction.update(currentUserRef, {
          followingCount: increment(1)
        });

        transaction.update(targetUserRef, {
          followersCount: increment(1)
        });
      }

    });

  } catch (error) {
    console.error("Follow transaction failed:", error);
  }
}

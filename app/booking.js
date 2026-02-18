import { auth, db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =====================================================
// CREATE SESSION
// =====================================================
export async function createSession(sessionData) {

  const user = auth.currentUser;
  if (!user) {
    alert("Login required");
    return;
  }

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists()) {
    alert("User not found");
    return;
  }

  const userData = userSnap.data();

  const {
    type,
    courtId,
    courtName,
    date,
    startTime,
    endTime,
    pricePerUser,
    maxParticipants,
    joinMode
  } = sessionData;


  // ==============================
  // GOVERNANCE CHECK
  // ==============================

  if (type === "fun") {
    if (
      userData.role !== "verified" &&
      userData.role !== "coach" &&
      userData.role !== "admin"
    ) {
      alert("Only verified members or coaches can create fun sessions.");
      return;
    }
  }

  if (type === "coaching") {
    if (
      userData.role !== "admin" &&
      (
        userData.role !== "coach" ||
        userData.coachApproved !== true
      )
    ) {
      alert("Only approved coaches or admin can create coaching sessions.");
      return;
    }
  }


  // ==============================
  // VALIDATION
  // ==============================

  if (!courtId || !date || !startTime || !endTime) {
    alert("Incomplete session data.");
    return;
  }

  if (!pricePerUser || pricePerUser <= 0) {
    alert("Invalid price.");
    return;
  }

  if (!maxParticipants || maxParticipants <= 0) {
    alert("Invalid participant limit.");
    return;
  }


  const newSessionRef = doc(collection(db, "sessions"));

  await setDoc(newSessionRef, {
    type,
    createdBy: user.uid,
    hostName: userData.name,
    courtId,
    courtName,
    date,
    startTime,
    endTime,
    joinMode: joinMode === "approval" ? "approval" : "instant",
    pricePerUser,
    maxParticipants,
    participantsCount: 0,
    platformFeePercent: 10,
    totalRevenue: 0,
    platformRevenue: 0,
    hostRevenue: 0,
    status: "open",
    createdAt: serverTimestamp()
  });

  alert("Session created successfully.");
}

// =====================================================
// JOIN SESSION
// =====================================================
export async function joinSession(sessionId) {

  const user = auth.currentUser;
  if (!user) {
    alert("Login required");
    return;
  }

  const sessionRef = doc(db, "sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) {
    alert("Session not found");
    return;
  }

  const session = sessionSnap.data();

  if (session.status !== "open") {
    alert("Session not open");
    return;
  }

  if (session.participantsCount >= session.maxParticipants) {
    alert("Session is full");
    return;
  }

  const participantRef = doc(
    db,
    "sessions",
    sessionId,
    "participants",
    user.uid
  );

  const participantSnap = await getDoc(participantRef);

  if (participantSnap.exists()) {
    alert("Already joined this session");
    return;
  }

  // ==========================
  // INSTANT MODE
  // ==========================
  if (session.joinMode === "instant") {

    const newCount = session.participantsCount + 1;

    await setDoc(participantRef, {
      status: "paid",
      joinedAt: new Date(),
      attendanceRecorded: false
    });

    await updateDoc(sessionRef, {
      participantsCount: newCount,
      status: newCount >= session.maxParticipants ? "full" : "open"
    });

    alert("Successfully joined session");

  } else {

    // ==========================
    // APPROVAL MODE
    // ==========================
    await setDoc(participantRef, {
      status: "pending",
      joinedAt: new Date(),
      attendanceRecorded: false
    });

    alert("Join request sent. Waiting for host approval.");
  }
}



// =====================================================
// APPROVE PARTICIPANT
// =====================================================
export async function approveParticipant(sessionId, targetUid) {

  const user = auth.currentUser;
  if (!user) {
    alert("Login required");
    return;
  }

  const sessionRef = doc(db, "sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) {
    alert("Session not found");
    return;
  }

  const session = sessionSnap.data();

  // Only host can approve
  if (session.createdBy !== user.uid) {
    alert("Not authorized to approve.");
    return;
  }

  if (session.status !== "open") {
    alert("Session not open.");
    return;
  }

  if (session.participantsCount >= session.maxParticipants) {
    alert("Session already full.");
    return;
  }

  const participantRef = doc(
    db,
    "sessions",
    sessionId,
    "participants",
    targetUid
  );

  const participantSnap = await getDoc(participantRef);

  if (!participantSnap.exists()) {
    alert("Participant not found.");
    return;
  }

  const participant = participantSnap.data();

  if (participant.status !== "pending") {
    alert("Participant not pending.");
    return;
  }

  const newCount = session.participantsCount + 1;

  await updateDoc(participantRef, {
    status: "paid"
  });

  await updateDoc(sessionRef, {
    participantsCount: newCount,
    status: newCount >= session.maxParticipants ? "full" : "open"
  });

  alert("Participant approved.");
}

// =====================================================
// REJECT PARTICIPANT
// =====================================================
export async function rejectParticipant(sessionId, targetUid) {

  const user = auth.currentUser;
  if (!user) {
    alert("Login required");
    return;
  }

  const sessionRef = doc(db, "sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) {
    alert("Session not found");
    return;
  }

  const session = sessionSnap.data();

  if (session.createdBy !== user.uid) {
    alert("Not authorized to reject.");
    return;
  }

  const participantRef = doc(
    db,
    "sessions",
    sessionId,
    "participants",
    targetUid
  );

  await updateDoc(participantRef, {
    status: "cancelled"
  });

  alert("Participant rejected.");
}


// =====================================================
// COMPLETE SESSION
// =====================================================
export async function completeSession(sessionId) {

  const user = auth.currentUser;
  if (!user) {
    alert("Login required");
    return;
  }

  const sessionRef = doc(db, "sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) {
    alert("Session not found");
    return;
  }

  const session = sessionSnap.data();

  if (session.createdBy !== user.uid) {
    alert("Only host can complete session.");
    return;
  }

  if (session.status !== "open" && session.status !== "full") {
    alert("Session cannot be completed.");
    return;
  }

  const participantsRef = collection(
    db,
    "sessions",
    sessionId,
    "participants"
  );

  const participantsSnap = await getDocs(participantsRef);

  let paidParticipants = [];

  participantsSnap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.status === "paid") {
      paidParticipants.push(docSnap.id);
    }
  });

  const totalParticipants = paidParticipants.length;

  const totalRevenue =
    totalParticipants * session.pricePerUser;

  const platformRevenue =
    totalRevenue * (session.platformFeePercent / 100);

  const hostRevenue =
    totalRevenue - platformRevenue;

  // Update attendance per user
  for (const uid of paidParticipants) {

    const userRef = doc(db, "users", uid);

    await updateDoc(userRef, {
      attendanceCount: increment(1)
    });
  }

  await updateDoc(sessionRef, {
    totalRevenue,
    platformRevenue,
    hostRevenue,
    status: "completed"
  });

  alert("Session completed successfully.");
}

// =====================================================
// CANCEL JOIN (PARTICIPANT)
// =====================================================
export async function cancelJoin(sessionId) {

  const user = auth.currentUser;
  if (!user) {
    alert("Login required");
    return;
  }

  const sessionRef = doc(db, "sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) {
    alert("Session not found");
    return;
  }

  const session = sessionSnap.data();

  if (session.status === "completed") {
    alert("Cannot cancel completed session.");
    return;
  }

  const participantRef = doc(
    db,
    "sessions",
    sessionId,
    "participants",
    user.uid
  );

  const participantSnap = await getDoc(participantRef);

  if (!participantSnap.exists()) {
    alert("Not part of this session.");
    return;
  }

  const participant = participantSnap.data();

  // If already paid → decrease participantsCount
  if (participant.status === "paid") {

    const newCount = Math.max(session.participantsCount - 1, 0);

    await updateDoc(sessionRef, {
      participantsCount: newCount,
      status: "open"
    });
  }

  await updateDoc(participantRef, {
    status: "cancelled"
  });

  alert("Join cancelled.");
}
// =====================================================
// CANCEL SESSION (HOST)
// =====================================================
export async function cancelSession(sessionId) {

  const user = auth.currentUser;
  if (!user) {
    alert("Login required");
    return;
  }

  const sessionRef = doc(db, "sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) {
    alert("Session not found");
    return;
  }

  const session = sessionSnap.data();

  if (session.createdBy !== user.uid) {
    alert("Only host can cancel session.");
    return;
  }

  if (session.status === "completed") {
    alert("Cannot cancel completed session.");
    return;
  }

  await updateDoc(sessionRef, {
    status: "cancelled"
  });

  alert("Session cancelled.");
}


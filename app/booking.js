import { auth, db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
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

  if (session.participantsCount >= session.maxParticipants) {
    alert("Session is full");
    return;
  }

  if (session.joinMode === "instant") {

    await setDoc(participantRef, {
      status: "paid",
      joinedAt: new Date(),
      attendanceRecorded: false
    });

    await updateDoc(sessionRef, {
      participantsCount: increment(1)
    });

    alert("Successfully joined session");

  } else {

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

  // Only host or admin can approve
  if (session.createdBy !== user.uid) {
  alert("Not authorized to approve.");
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

  // Capacity check
  if (session.participantsCount >= session.maxParticipants) {
    alert("Session already full.");
    return;
  }

  // Update participant to paid
  await updateDoc(participantRef, {
    status: "paid"
  });

  // Increment participantsCount
  await updateDoc(sessionRef, {
    participantsCount: increment(1)
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


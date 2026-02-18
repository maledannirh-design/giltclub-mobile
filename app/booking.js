import { auth, db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ==============================
// CREATE SESSION
// ==============================
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
// JOIN SESSION (HYBRID)
// ==============================
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

  // Check if already joined
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

  // Check capacity
  if (session.participantsCount >= session.maxParticipants) {
    alert("Session is full");
    return;
  }

  // ==============================
  // HYBRID MODE
  // ==============================

  if (session.joinMode === "instant") {

    // Create participant as paid
    await setDoc(participantRef, {
      status: "paid",
      joinedAt: new Date(),
      attendanceRecorded: false
    });

    // Increment participantsCount
    await updateDoc(sessionRef, {
      participantsCount: increment(1)
    });

    alert("Successfully joined session");

  } else {

    // Approval mode
    await setDoc(participantRef, {
      status: "pending",
      joinedAt: new Date(),
      attendanceRecorded: false
    });

    alert("Join request sent. Waiting for host approval.");
  }

}

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
  // BASIC VALIDATION
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

  // ==============================
  // CREATE SESSION
  // ==============================

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

    joinMode: joinMode || "instant",

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

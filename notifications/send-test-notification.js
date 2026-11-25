import admin from "firebase-admin";

const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const targetUid = String(process.env.TARGET_UID || "").trim();

if (!serviceAccountRaw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON secret");
if (!targetUid || targetUid.length > 128 || /[^a-zA-Z0-9_-]/.test(targetUid)) {
  throw new Error("TARGET_UID is missing or invalid");
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccountRaw))
});

const db = admin.firestore();
const messaging = admin.messaging();
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;

function witaDateString(date) {
  return new Date(date.getTime() + WITA_OFFSET_MS).toISOString().slice(0, 10);
}

async function main() {
  // This is a DEMO path only: find this user's real active booking for today,
  // independent of the production four-hour screening window.
  const todayWita = witaDateString(new Date());
  const [subscriptionsSnap, bookingsSnap] = await Promise.all([
    db.collection("users").doc(targetUid).collection("pushSubscriptions").get(),
    db.collection("bookings").where("userId", "==", targetUid).get()
  ]);

  const devices = subscriptionsSnap.docs
    .map(doc => ({ ref: doc.ref, token: doc.data().token }))
    .filter(item => typeof item.token === "string" && item.token.length > 20);

  if (!devices.length) {
    throw new Error("No registered push devices found for this user. Activate notifications in GMTC first.");
  }

  const activeBookings = bookingsSnap.docs
    .map(doc => ({ ref: doc.ref, ...doc.data() }))
    .filter(booking =>
      booking.status === "active" &&
      booking.waitlisted !== true &&
      typeof booking.scheduleId === "string"
    );

  const candidates = [];
  for (const booking of activeBookings) {
    const scheduleSnap = await db.collection("schedules").doc(booking.scheduleId).get();
    if (!scheduleSnap.exists) continue;
    const schedule = scheduleSnap.data();
    const scheduleStatus = String(schedule.status || "open").toLowerCase();
    if (["cancelled", "canceled"].includes(scheduleStatus)) continue;
    if (schedule.date !== todayWita || !schedule.startTime) continue;

    candidates.push({
      scheduleId: scheduleSnap.id,
      schedule,
      bookingId: booking.ref.id
    });
  }

  candidates.sort((a, b) => String(a.schedule.startTime).localeCompare(String(b.schedule.startTime)));
  const selected = candidates[0];

  if (!selected) {
    throw new Error("No active main-slot booking found for this account today (WITA). Create or select a booking for today's date first.");
  }

  const schedule = selected.schedule;
  const dateLabel = new Date(todayWita + "T00:00:00+08:00")
    .toLocaleDateString("id-ID", {
      timeZone: "Asia/Makassar",
      weekday: "long",
      day: "numeric",
      month: "long"
    });
  const start = String(schedule.startTime).slice(0, 5);
  const end = schedule.endTime ? String(schedule.endTime).slice(0, 5) : "";
  const timeLabel = end ? start + "–" + end : start;
  const court = schedule.courtName || schedule.location || schedule.venue || schedule.court || "Lapangan tenis";

  const response = await messaging.sendEachForMulticast({
    tokens: devices.map(device => device.token),
    data: {
      title: "GMTC · Simulasi Reminder Play Session",
      body: "Booking kamu hari ini: " + court + ", pukul " + timeLabel + " WITA (" + dateLabel + "). Ini simulasi reminder GMTC.",
      url: "/app/",
      type: "booking-reminder-demo",
      scheduleId: selected.scheduleId,
      date: todayWita,
      startTime: start
    },
    webpush: {
      headers: { Urgency: "high", TTL: "300" }
    }
  });

  const invalidRefs = [];
  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code = result.error?.code || "";
      console.error("Push failed for one device:", code);
      if (code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token")) {
        invalidRefs.push(devices[index].ref);
      }
    }
  });
  await Promise.all(invalidRefs.map(ref => ref.delete()));

  console.log(JSON.stringify({
    status: response.successCount > 0 ? "sent" : "failed",
    mode: "simulation-only",
    targetUid,
    sessionDate: todayWita,
    court,
    startTime: start,
    endTime: end || null,
    devicesFound: devices.length,
    successCount: response.successCount,
    failureCount: response.failureCount
  }, null, 2));

  if (response.successCount === 0) {
    throw new Error("FCM could not deliver the booking simulation to any registered device.");
  }
}

main().catch(error => {
  console.error("GMTC booking reminder simulation failed:", error);
  process.exitCode = 1;
});

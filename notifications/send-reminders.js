import admin from "firebase-admin";

const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!serviceAccountRaw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON secret");

const serviceAccount = JSON.parse(serviceAccountRaw);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const messaging = admin.messaging();
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;
const now = new Date();
const windowEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000);

function witaDateString(date) {
  return new Date(date.getTime() + WITA_OFFSET_MS).toISOString().slice(0, 10);
}
function sessionDateTime(date, time) {
  return new Date(date + "T" + time + ":00+08:00");
}

async function main() {
  const startDate = witaDateString(now);
  const endDate = witaDateString(windowEnd);
  const scheduleSnap = await db.collection("schedules")
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get();

  let scanned = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const scheduleDoc of scheduleSnap.docs) {
    const schedule = scheduleDoc.data();
    const scheduleStatus = String(schedule.status || "open").toLowerCase();
    if (["cancelled", "canceled"].includes(scheduleStatus)) continue;
    if (!schedule.date || !schedule.startTime) continue;

    const startsAt = sessionDateTime(schedule.date, schedule.startTime);
    if (startsAt < now || startsAt >= windowEnd) continue;

    const reminderKey = scheduleDoc.id + "_" + schedule.date + "_" + schedule.startTime;
    const bookingSnap = await db.collection("bookings")
      .where("scheduleId", "==", scheduleDoc.id)
      .get();

    for (const bookingDoc of bookingSnap.docs) {
      scanned++;
      const booking = bookingDoc.data();

      if (booking.status !== "active") {
        skipped++;
        continue;
      }

      // Waitlisted bookings never receive a session reminder. Legacy bookings
      // without this field are treated as main-slot bookings.
      if (booking.waitlisted === true || !booking.userId) {
        skipped++;
        continue;
      }
      if (booking.pushReminderKey === reminderKey) {
        skipped++;
        continue;
      }

      const subscriptionsSnap = await db.collection("users")
        .doc(booking.userId)
        .collection("pushSubscriptions")
        .get();

      const tokens = subscriptionsSnap.docs
        .map(doc => ({ id: doc.id, token: doc.data().token }))
        .filter(item => typeof item.token === "string" && item.token.length > 20);

      if (!tokens.length) {
        skipped++;
        continue;
      }

      const dateLabel = new Date(schedule.date + "T00:00:00+08:00")
        .toLocaleDateString("id-ID", { timeZone: "Asia/Makassar", weekday:"long", day:"numeric", month:"long" });
      const title = "GMTC · Reminder Play Session";
      const body = "Sesi kamu dimulai pukul " + schedule.startTime + " WITA, " + dateLabel + ". Jangan sampai terlambat!";
      const response = await messaging.sendEachForMulticast({
        tokens: tokens.map(item => item.token),
        data: {
          title,
          body,
          scheduleId: scheduleDoc.id,
          date: schedule.date,
          startTime: schedule.startTime,
          url: "/app/"
        },
        webpush: {
          headers: { Urgency: "high", TTL: "86400" }
        }
      });

      const invalidTokenIds = [];
      response.responses.forEach((result, index) => {
        if (result.success) sent++;
        else {
          failed++;
          const code = result.error?.code || "";
          if (code.includes("registration-token-not-registered") ||
              code.includes("invalid-registration-token")) {
            invalidTokenIds.push(tokens[index].id);
          }
        }
      });

      for (const tokenId of invalidTokenIds) {
        await subscriptionsSnap.docs.find(doc => doc.id === tokenId)?.ref.delete();
      }

      if (response.successCount > 0) {
        await bookingDoc.ref.set({
          pushReminderKey: reminderKey,
          pushReminderSentAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }
  }

  console.log(JSON.stringify({
    status: "completed",
    windowStart: now.toISOString(),
    windowEnd: windowEnd.toISOString(),
    schedulesScanned: scheduleSnap.size,
    bookingsScanned: scanned,
    notificationsSent: sent,
    skipped,
    failed
  }, null, 2));
}

main().catch(error => {
  console.error("Push reminder job failed:", error);
  process.exitCode = 1;
});

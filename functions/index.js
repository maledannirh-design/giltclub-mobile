const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();
const TIME_ZONE = "Asia/Makassar"; // WITA, UTC+8
const SUMMARY_REF = db.collection("websiteStats").doc("ActivitySummary");

function dateKeyInWita(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function minutesBetween(startTime, endTime) {
  if (typeof startTime !== "string" || typeof endTime !== "string") return 0;
  const parse = value => {
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
  };
  const start = parse(startTime);
  const end = parse(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const duration = end - start;
  return duration > 0 && duration <= 24 * 60 ? duration : 0;
}

exports.refreshActivitySummary = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: TIME_ZONE,
    region: "asia-southeast1",
    retryCount: 1
  },
  async () => {
    const todayWita = dateKeyInWita();
    // A single daily collection scan replaces repeated website-side scans/listeners.
    const schedulesSnapshot = await db.collection("schedules").get();

    let sessionsHosted = 0;
    let playerAttendances = 0;
    let courtMinutesPlayed = 0;

    for (const scheduleDoc of schedulesSnapshot.docs) {
      const schedule = scheduleDoc.data();
      if (!schedule.date || typeof schedule.date !== "string") continue;
      // Activity Summary is historical: do not count future sessions.
      if (schedule.date > todayWita) continue;

      const maxPlayers = Number(schedule.maxPlayers);
      const remainingSlots = Number(schedule.slots);
      if (!Number.isFinite(maxPlayers) || !Number.isFinite(remainingSlots)) continue;

      const filledSlots = Math.max(0, Math.min(maxPlayers, maxPlayers - remainingSlots));
      if (filledSlots <= 0) continue;

      sessionsHosted += 1;
      playerAttendances += filledSlots;
      courtMinutesPlayed += minutesBetween(schedule.startTime, schedule.endTime);
    }

    await SUMMARY_REF.set({
      sessionsHosted,
      playerAttendances,
      courtHoursPlayed: Math.round((courtMinutesPlayed / 60) * 10) / 10,
      source: "schedules",
      attendanceDefinition: "sum(maxPlayers - slots) for past sessions with at least one filled slot",
      generatedAt: FieldValue.serverTimestamp(),
      generatedDateWita: todayWita,
      scheduleDocumentsScanned: schedulesSnapshot.size
    });

    logger.info("GMTC Activity Summary refreshed", {
      sessionsHosted,
      playerAttendances,
      courtHoursPlayed: Math.round((courtMinutesPlayed / 60) * 10) / 10,
      scheduleDocumentsScanned: schedulesSnapshot.size,
      generatedDateWita: todayWita
    });
  }
);

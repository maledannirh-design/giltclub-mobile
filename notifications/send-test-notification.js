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

async function main() {
  const subscriptions = await db.collection("users")
    .doc(targetUid)
    .collection("pushSubscriptions")
    .get();

  const devices = subscriptions.docs
    .map(doc => ({ ref: doc.ref, token: doc.data().token }))
    .filter(item => typeof item.token === "string" && item.token.length > 20);

  if (!devices.length) {
    throw new Error("No registered push devices found for this user. Activate notifications in GMTC first.");
  }

  const response = await messaging.sendEachForMulticast({
    tokens: devices.map(device => device.token),
    data: {
      title: "GMTC · Test Notification",
      body: "Berhasil! Perangkat ini sudah terhubung dengan notifikasi GMTC.",
      url: "/app/",
      type: "test"
    },
    webpush: {
      headers: { Urgency: "high", TTL: "300" }
    }
  });

  const invalidIds = [];
  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code = result.error?.code || "";
      console.error("Push failed for one device:", code);
      if (code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token")) {
        invalidIds.push(devices[index].ref);
      }
    }
  });

  await Promise.all(invalidIds.map(ref => ref.delete()));

  console.log(JSON.stringify({
    status: response.successCount > 0 ? "sent" : "failed",
    targetUid,
    devicesFound: devices.length,
    successCount: response.successCount,
    failureCount: response.failureCount
  }, null, 2));

  if (response.successCount === 0) {
    throw new Error("FCM could not deliver the test notification to any registered device.");
  }
}

main().catch(error => {
  console.error("GMTC push test failed:", error);
  process.exitCode = 1;
});

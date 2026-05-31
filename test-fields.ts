import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { initializeFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

async function probeFields() {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId);

  const randomId = Math.floor(Math.random() * 100000);
  const testEmail = `test_probe_${randomId}@example.com`;
  const cred = await createUserWithEmailAndPassword(auth, testEmail, "pass123456");
  const uid = cred.user.uid;

  console.log(`Created test user: ${uid}`);

  const makePayload = (role: string, status: string) => ({
    userId: uid,
    username: `user_${randomId}`,
    email: testEmail,
    role: role,
    account_name: `Account ${randomId}`,
    operator_name: "",
    status: status,
    assigned_upt_id: "",
    assigned_upt_name: "",
    createdAt: serverTimestamp()
  });

  const payloads = [
    {
      label: "Full payload with role: viewer, status: pending",
      data: makePayload("viewer", "pending")
    },
    {
      label: "Full payload with role: admin, status: active",
      data: makePayload("admin", "active")
    },
    {
      label: "Full payload with role: operator_bakung, status: active",
      data: makePayload("operator_bakung", "active")
    },
    {
      label: "Full payload with role: user, status: pending",
      data: makePayload("user", "pending")
    }
  ];

  for (const item of payloads) {
    try {
      await setDoc(doc(db, "users", uid), item.data);
      console.log(`[PASS] ${item.label}`);
    } catch (err: any) {
      console.log(`[FAIL] ${item.label}: ${err.message}`);
    }
  }

  await deleteUser(cred.user);
  console.log("Cleanup complete!");
}

probeFields().catch(console.error);

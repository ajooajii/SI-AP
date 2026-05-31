import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { initializeFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`TIMEOUT: "${label}" did not resolve after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runWriteTest(dbId: string | undefined): Promise<{ success: boolean; error?: string }> {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  const app = initializeApp(config);
  const auth = getAuth(app);
  
  const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, dbId);

  const randomId = Math.floor(Math.random() * 100000);
  const testEmail = `test_field_runner_${randomId}@example.com`;
  const testPass = "super_secure_pass123";

  try {
    const cred = await withTimeout(
      createUserWithEmailAndPassword(auth, testEmail, testPass),
      10000,
      "createUserWithEmailAndPassword"
    );
    const uid = cred.user.uid;

    const profileData = {
      userId: uid,
      username: `test_field_runner_${randomId}`,
      email: testEmail,
      role: "viewer",
      account_name: `Test Runner ${randomId}`,
      operator_name: "",
      status: "pending",
      assigned_upt_id: "",
      assigned_upt_name: "",
      createdAt: serverTimestamp()
    };

    console.log(`[FIRESTORE] Probing Standard Viewer write on users/${uid}...`);

    try {
      await withTimeout(
        setDoc(doc(db, "users", uid), profileData),
        10000,
        "setDoc write operation"
      );
      await deleteUser(cred.user);
      return { success: true };
    } catch (dbError: any) {
      await deleteUser(cred.user);
      return { success: false, error: dbError.message };
    }
  } catch (authError: any) {
    return { success: false, error: `AUTH ERROR: ${authError.message}` };
  }
}

async function main() {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const customDbId = config.firestoreDatabaseId;

  console.log("---- POLLING SECURITY RULES PROPAGATION ----");
  
  for (let attempt = 1; attempt <= 4; attempt++) {
    console.log(`\n--- Attempt ${attempt}/4 ---`);
    const res = await runWriteTest(customDbId);
    if (res.success) {
      console.log(`[SUCCESS] Rule active! Standard viewer write succeeded.`);
      process.exit(0);
    } else {
      console.log(`[WAITING] Write rejected: ${res.error}`);
      if (attempt < 4) {
        console.log("Sleeping for 10 seconds before next probe...");
        await sleep(10000);
      }
    }
  }

  console.log("\n[VERDICT] Polling complete. Rules did not propagate yet or remain blocked.");
  process.exit(1);
}

main().catch(console.error);

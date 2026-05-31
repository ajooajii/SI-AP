import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { initializeFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

async function runTest(email: string, role: string, status: string, accountName: string, isFullPayload = false) {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { experimentalForceLongPolling: true }, config.firestoreDatabaseId);

  const internalDb = db as any;
  const targetDbId = internalDb._databaseId?.database || "default";
  const targetProjectId = internalDb._databaseId?.projectId || "unknown";
  console.log(`[CLIENT SDK] Connected to: ${targetProjectId} / ${targetDbId}`);

  const testPass = "super_secure_pass123";
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, testPass);
    const uid = cred.user.uid;
    
    // Add a sleep to prevent Auth-to-Firestore token race conditions
    await new Promise((r) => setTimeout(r, 2000));

    let profileData: any = {
      userId: uid,
      username: email.split("@")[0],
      email: email,
      role: role,
      account_name: accountName,
      operator_name: "",
      status: status,
      assigned_upt_id: "",
      assigned_upt_name: "",
      createdAt: serverTimestamp()
    };

    if (isFullPayload) {
      profileData = {
        ...profileData,
        assignedUptId: "",
        assignedUptName: "",
        can_input_ritase: false,
        isAdmin: false,
        isCoAdmin: false
      };
    }

    console.log(`[TEST] UID: ${uid} | Email: ${email} | Role: ${role} | Status: ${status} | FullPayload: ${isFullPayload}`);
    try {
      await setDoc(doc(db, "users", uid), profileData);
      console.log(`[SUCCESS] Write succeeded for ${email}!`);
      await deleteUser(cred.user);
      return { success: true };
    } catch (e: any) {
      console.log(`[FAILED] Write rejected for ${email}: ${e.message}`);
      await deleteUser(cred.user);
      return { success: false, error: e.message };
    }
  } catch (authErr: any) {
    console.log(`[AUTH ERROR] for ${email}: ${authErr.message}`);
    return { success: false, error: authErr.message };
  }
}

async function main() {
  console.log("=== DIAGNOSTIC COMBO RUN ===");
  const randomSuffix = Math.floor(Math.random() * 100000);
  
  console.log("\n1. Testing master admin bootstrap format:");
  await runTest(`bpsdlh@gmail.com`, "admin", "active", "Master Admin DLH");

  console.log("\n2. Testing standard user format (role: user, simple payload):");
  await runTest(`test_user_${randomSuffix}@example.com`, "user", "pending", `Test User ${randomSuffix}`);

  console.log("\n3. Testing standard user format (role: viewer, simple payload):");
  await runTest(`test_viewer_simple_${randomSuffix}@example.com`, "viewer", "pending", `Test Viewer ${randomSuffix}`);

  console.log("\n4. Testing standard user format (role: viewer, full old payload):");
  await runTest(`test_viewer_full_${randomSuffix}@example.com`, "viewer", "pending", `Test Viewer ${randomSuffix}`, true);
}

main().catch(console.error);

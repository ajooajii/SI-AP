import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { initializeFirestore, doc, setDoc, addDoc, collection } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const app = initializeApp(config);
  const auth = getAuth(app);
  
  const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, config.firestoreDatabaseId);

  const testEmail = `operator_${Math.floor(Math.random() * 100000)}@example.com`;
  const testPass = "password123";

  console.log(`Starting test for ${testEmail}...`);

  try {
    const cred = await createUserWithEmailAndPassword(auth, testEmail, testPass);
    const uid = cred.user.uid;
    console.log(`User created with UID: ${uid}`);

    // Create user document
    const userPayload = {
      userId: uid,
      username: `operator_${uid.substring(0,5)}`,
      email: testEmail,
      role: "operator_bakung",
      account_name: "Bakung Operator Account",
      status: "active"
    };

    await setDoc(doc(db, "users", uid), userPayload);
    console.log("User document created.");

    // Write to data_sampah_bakung
    const tripPayload = {
      created_by_uid: uid,
      created_by_role: "operator_bakung",
      status: "valid",
      gross_weight_kg: 1000,
      default_empty_weight_kg: 500,
      net_operational_weight_kg: 500,
      plate_number: "BG 1234 ABC",
      date: "2026-05-30",
      time: "12:00"
    };
    
    console.log("Attempting to write to data_sampah_bakung...");
    await addDoc(collection(db, "data_sampah_bakung"), tripPayload);
    console.log("[PASS] Write to data_sampah_bakung succeeded.");
    
    await deleteUser(cred.user);
    console.log("Cleanup complete.");
    process.exit(0);
  } catch (err: any) {
    console.error("[FAIL] Error details:", err.code, err.message);
    process.exit(1);
  }
}

main().catch(console.error);

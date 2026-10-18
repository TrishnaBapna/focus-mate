/**
 * Real Firebase Emulator Suite Integration Tests
 *
 * Targets actual firestore.rules and storage.rules files using @firebase/rules-unit-testing.
 * Runs against the local Firestore and Storage emulators with a isolated demo project ID
 * ('demo-focusmate-test') to guarantee zero interaction with production resources.
 *
 * NOTE: Requires Java Runtime (JRE/JDK 11+) on the system to run the Firebase Emulator Suite.
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes, deleteObject } from "firebase/storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ID = "demo-focusmate-test";

// Load actual rules files from project root
const firestoreRulesPath = path.resolve(__dirname, "../../firestore.rules");
const storageRulesPath = path.resolve(__dirname, "../../storage.rules");

const firestoreRules = fs.readFileSync(firestoreRulesPath, "utf8");
const storageRules = fs.readFileSync(storageRulesPath, "utf8");

export async function runEmulatorRulesTests() {
  console.log("Initializing Firebase Rules Test Environment with live rules...");

  let testEnv: RulesTestEnvironment;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: firestoreRules,
        host: "127.0.0.1",
        port: 8080,
      },
      storage: {
        rules: storageRules,
        host: "127.0.0.1",
        port: 9199,
      },
    });
  } catch (err) {
    console.error("Failed to connect to Firebase Emulator Suite:", err);
    console.error("Please ensure the Firebase Emulator is running: `firebase emulators:start` with Java installed.");
    throw err;
  }

  try {
    const aliceUid = "user_alice_123";
    const bobUid = "user_bob_456";

    const unauthContext = testEnv.unauthenticatedContext();
    const aliceContext = testEnv.authenticatedContext(aliceUid);
    const bobContext = testEnv.authenticatedContext(bobUid);

    const aliceDb = aliceContext.firestore();
    const bobDb = bobContext.firestore();
    const unauthDb = unauthContext.firestore();

    const aliceStorage = aliceContext.storage();
    const bobStorage = bobContext.storage();
    const unauthStorage = unauthContext.storage();

    console.log("--- Running Firestore Rules Verification ---");

    // 1. Unauthenticated access rejected
    await assertFails(
      getDoc(doc(unauthDb, "users", aliceUid, "sessions", "sess_1")),
      "Unauthenticated user must not read user sessions"
    );
    await assertFails(
      setDoc(doc(unauthDb, "users", aliceUid, "sessions", "sess_1"), {
        durationSeconds: 1500,
        mode: "timer",
        subjectId: "math",
      }),
      "Unauthenticated user must not write user sessions"
    );

    // 2. Cross-user access rejected
    await assertFails(
      getDoc(doc(bobDb, "users", aliceUid, "sessions", "sess_1")),
      "Bob must not read Alice's sessions"
    );
    await assertFails(
      setDoc(doc(bobDb, "users", aliceUid, "sessions", "sess_1"), {
        durationSeconds: 1500,
        mode: "timer",
        subjectId: "math",
      }),
      "Bob must not write Alice's sessions"
    );

    // 3. Valid application writes permitted
    await assertSucceeds(
      setDoc(doc(aliceDb, "users", aliceUid, "sessions", "sess_1"), {
        durationSeconds: 1500,
        mode: "timer",
        subjectId: "math",
      }),
      "Alice must be able to create valid session"
    );
    await assertSucceeds(
      getDoc(doc(aliceDb, "users", aliceUid, "sessions", "sess_1")),
      "Alice must be able to read her own session"
    );

    // 4. Malformed session rejected (oversized duration > 24h, invalid mode)
    await assertFails(
      setDoc(doc(aliceDb, "users", aliceUid, "sessions", "sess_bad_duration"), {
        durationSeconds: 999999, // > 86400
        mode: "timer",
        subjectId: "math",
      }),
      "Session duration > 86400 must be rejected"
    );
    await assertFails(
      setDoc(doc(aliceDb, "users", aliceUid, "sessions", "sess_bad_mode"), {
        durationSeconds: 1500,
        mode: "freeform", // not in ['timer', 'stopwatch', 'pomodoro']
        subjectId: "math",
      }),
      "Session mode not in enum must be rejected"
    );
    await assertFails(
      setDoc(doc(aliceDb, "users", aliceUid, "sessions", "sess_bad_keys"), {
        durationSeconds: 1500,
        mode: "timer",
        subjectId: "math",
        injectedHackerField: "exploit",
      }),
      "Session with unexpected fields must be rejected"
    );

    // 4b. Session updates: core metrics and unexpected fields cannot be mutated
    await assertFails(
      updateDoc(doc(aliceDb, "users", aliceUid, "sessions", "sess_1"), {
        durationSeconds: 600, // mutated duration
      }),
      "Session duration update must be rejected"
    );
    await assertFails(
      updateDoc(doc(aliceDb, "users", aliceUid, "sessions", "sess_1"), {
        injectedField: true,
      }),
      "Injecting unexpected fields on session update must be rejected"
    );
    await assertFails(
      updateDoc(doc(aliceDb, "users", aliceUid, "sessions", "sess_1"), {
        topic: "Altered Topic",
      }),
      "Altering session topic on update must be rejected"
    );
    await assertSucceeds(
      setDoc(doc(aliceDb, "users", aliceUid, "sessions", "sess_1"), {
        durationSeconds: 1500,
        mode: "timer",
        subjectId: "math",
      }, { merge: true }),
      "Idempotent session retry with identical core metrics must succeed"
    );

    // 5. Valid assessment creation
    await assertSucceeds(
      setDoc(doc(aliceDb, "users", aliceUid, "assessments", "eval_1"), {
        topic: "Calculus",
        score: 8,
        totalQuestions: 10,
        accuracy: 0.8,
        subjectId: "math",
      }),
      "Alice must be able to create valid assessment"
    );

    // 6. Malformed assessment rejected (missing fields, accuracy > 1, score < 0)
    await assertFails(
      setDoc(doc(aliceDb, "users", aliceUid, "assessments", "eval_missing"), {
        topic: "Calculus",
        score: 8,
        // missing totalQuestions & accuracy
      }),
      "Assessment missing required fields must be rejected"
    );
    await assertFails(
      setDoc(doc(aliceDb, "users", aliceUid, "assessments", "eval_bad_acc"), {
        topic: "Calculus",
        score: 8,
        totalQuestions: 10,
        accuracy: 1.5, // > 1.0
      }),
      "Assessment accuracy > 1.0 must be rejected"
    );

    // 7. Assessment Immutability: updates and deletes strictly forbidden
    await assertFails(
      updateDoc(doc(aliceDb, "users", aliceUid, "assessments", "eval_1"), {
        score: 10,
      }),
      "Assessment update must be strictly rejected"
    );
    await assertFails(
      deleteDoc(doc(aliceDb, "users", aliceUid, "assessments", "eval_1")),
      "Assessment deletion must be strictly rejected"
    );

    // 8. Subject Goals validation
    await assertSucceeds(
      setDoc(doc(aliceDb, "users", aliceUid, "subjectGoals", "math"), {
        targetHours: 10,
      }),
      "Valid subject goal must be accepted"
    );
    await assertFails(
      setDoc(doc(aliceDb, "users", aliceUid, "subjectGoals", "math_overflow"), {
        targetHours: 200, // > 168 (hours in a week)
      }),
      "Subject goal > 168 hours must be rejected"
    );

    // 9. Other application collections permitted for owner
    await assertSucceeds(
      setDoc(doc(aliceDb, "users", aliceUid, "notes", "note_1"), {
        title: "My Physics Note",
        type: "typed",
      }),
      "Alice must be able to create notes"
    );
    await assertSucceeds(
      setDoc(doc(aliceDb, "users", aliceUid, "tasks", "task_1"), {
        title: "Study Chapter 4",
      }),
      "Alice must be able to create tasks"
    );

    console.log("--- Running Storage Rules Verification ---");

    const smallImage = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // dummy PNG
    const oversizedBuffer = new Uint8Array(26 * 1024 * 1024); // 26 MB

    // 10. Storage unauthenticated access rejected
    await assertFails(
      uploadBytes(ref(unauthStorage, `users/${aliceUid}/images/pic.png`), smallImage, {
        contentType: "image/png",
      }),
      "Unauthenticated user must not upload storage media"
    );

    // 11. Storage cross-user access rejected
    await assertFails(
      uploadBytes(ref(bobStorage, `users/${aliceUid}/images/pic.png`), smallImage, {
        contentType: "image/png",
      }),
      "Bob must not upload to Alice's storage directory"
    );
    await assertFails(
      getBytes(ref(bobStorage, `users/${aliceUid}/images/pic.png`)),
      "Bob must not read from Alice's storage directory"
    );
    await assertFails(
      deleteObject(ref(bobStorage, `users/${aliceUid}/images/pic.png`)),
      "Bob must not delete Alice's storage file"
    );

    // 12. Valid storage uploads permitted
    await assertSucceeds(
      uploadBytes(ref(aliceStorage, `users/${aliceUid}/images/diagram.png`), smallImage, {
        contentType: "image/png",
      }),
      "Alice must be able to upload valid image"
    );
    await assertSucceeds(
      deleteObject(ref(aliceStorage, `users/${aliceUid}/images/diagram.png`)),
      "Alice must be able to delete her own storage media"
    );
    await assertSucceeds(
      uploadBytes(ref(aliceStorage, `users/${aliceUid}/audio/voice.mp3`), smallImage, {
        contentType: "audio/mp3",
      }),
      "Alice must be able to upload voice note"
    );
    await assertSucceeds(
      uploadBytes(ref(aliceStorage, `users/${aliceUid}/docs/scan.pdf`), smallImage, {
        contentType: "application/pdf",
      }),
      "Alice must be able to upload PDF scan"
    );

    // 13. Invalid media type rejected
    await assertFails(
      uploadBytes(ref(aliceStorage, `users/${aliceUid}/files/malicious.exe`), smallImage, {
        contentType: "application/x-msdownload",
      }),
      "Disallowed MIME types must be rejected"
    );
    await assertFails(
      uploadBytes(ref(aliceStorage, `users/${aliceUid}/files/page.html`), smallImage, {
        contentType: "text/html",
      }),
      "HTML uploads must be rejected to prevent stored XSS"
    );

    // 14. Oversized upload rejected (> 25MB)
    await assertFails(
      uploadBytes(ref(aliceStorage, `users/${aliceUid}/images/huge.png`), oversizedBuffer, {
        contentType: "image/png",
      }),
      "Files exceeding 25MB must be rejected by storage rules"
    );

    // 15. Path scoping: files outside users/{userId}/** rejected
    await assertFails(
      uploadBytes(ref(aliceStorage, `public/shared.png`), smallImage, {
        contentType: "image/png",
      }),
      "Files outside user directory must be rejected"
    );

    console.log("All Firebase Emulator Suite integration tests passed successfully! 🛡️");
  } finally {
    await testEnv.cleanup();
  }
}

// Auto-run if executed directly
if (typeof process !== "undefined" && process.argv[1]?.includes("emulatorRules.test")) {
  runEmulatorRulesTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

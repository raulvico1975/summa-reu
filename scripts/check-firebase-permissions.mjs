import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signOut } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from "firebase/firestore";
import { getStorage, connectStorageEmulator, ref, uploadString } from "firebase/storage";

const useEmulators = process.env.PERM_USE_EMULATORS === "true";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "summa-board.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "summa-board",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "summa-board.firebasestorage.app",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:000000000:web:summa-board",
};

const app = initializeApp(firebaseConfig, "permissions-check");
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8085);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

function isPermissionDenied(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");

  return (
    code.includes("permission-denied") ||
    code.includes("storage/unauthorized") ||
    code.includes("storage/unauthenticated") ||
    message.toLowerCase().includes("missing or insufficient permissions") ||
    message.toLowerCase().includes("permission denied") ||
    message.toLowerCase().includes("unauthorized")
  );
}

async function expectDenied(label, fn) {
  try {
    await fn();
  } catch (error) {
    if (isPermissionDenied(error)) {
      console.log(`OK ${label}: bloquejat correctament`);
      return;
    }

    throw new Error(`${label} ha fallat amb error inesperat: ${String(error?.message || error)}`);
  }

  throw new Error(`${label} NO bloquejat: un client públic ha pogut escriure`);
}

await signOut(auth).catch(() => undefined);

await expectDenied("Firestore write públic", async () => {
  const id = `perm-${Date.now()}`;
  await setDoc(doc(db, "polls", id), {
    title: "No permès",
    createdAt: new Date().toISOString(),
  });
});

await expectDenied("Storage write públic", async () => {
  const objectRef = ref(storage, `meetings/perm-check/recordings/${Date.now()}.txt`);
  await uploadString(objectRef, "test");
});

console.log("Permissions OK");

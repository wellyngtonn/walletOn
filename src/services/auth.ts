import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  let result;
  try {
    result = await signInWithPopup(auth, provider);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "auth/popup-blocked" ||
        error.code === "auth/popup-closed-by-user")
    ) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
  await saveGoogleUser(result.user);
}

async function saveGoogleUser(user: { uid: string; displayName: string | null; email: string | null }) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      name: user.displayName,
      email: user.email,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function completeGoogleRedirect() {
  const result = await getRedirectResult(auth);
  if (result) await saveGoogleUser(result.user);
}
export const signInEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);
export async function registerEmail(
  name: string,
  email: string,
  password: string,
) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", result.user.uid), {
    name,
    email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
export const resetPassword = (email: string) =>
  sendPasswordResetEmail(auth, email);
export const logout = () => signOut(auth);

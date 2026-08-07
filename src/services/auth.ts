import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
export async function signInGoogle() {
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  await setDoc(
    doc(db, "users", result.user.uid),
    {
      name: result.user.displayName,
      email: result.user.email,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
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

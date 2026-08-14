import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyBKoiLrRiTrhgV_he4_sdHM6TVKeajtU-8",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "wallet-on-c0b05.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "wallet-on-c0b05",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "wallet-on-c0b05.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "341654805972",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:341654805972:web:a7d990da4a170d678b4a41",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-NQRR79LDH",
};
export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export async function initAnalytics(): Promise<Analytics | null> {
  return typeof window !== "undefined" && (await isSupported())
    ? getAnalytics(firebaseApp)
    : null;
}

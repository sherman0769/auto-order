"use client";

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";   // ← 新增

/* ---------- Firebase 設定 ---------- */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
};

/* ---------- 僅在瀏覽器端初始化 ---------- */
function createFirebase() {
  if (typeof window === "undefined") return null as const;

  const app: FirebaseApp =
    getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  return {
    app,
    db: getFirestore(app),
    auth: getAuth(app),
    storage: getStorage(app),               // ← 新增
  } as const;
}

/* ---------- 導出 ---------- */
export const firebase = createFirebase();

export const db: Firestore | null = firebase?.db ?? null;
export const auth: Auth | null = firebase?.auth ?? null;
export const storage: FirebaseStorage | null = firebase?.storage ?? null;  // ← 新增

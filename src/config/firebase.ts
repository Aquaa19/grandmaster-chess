// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/config/firebase.ts

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Vite exposes environment variables via import.meta.env
let firebaseConfig: any = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Handle dynamic config injection from window
if (typeof window !== 'undefined' && window.__firebase_config) {
  try {
    const config = typeof window.__firebase_config === 'string'
      ? JSON.parse(window.__firebase_config)
      : window.__firebase_config;
    firebaseConfig = { ...firebaseConfig, ...config };
  } catch (e) {
    console.error("Error parsing injected firebase config:", e);
  }
}


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Use the Project ID as the App ID for our namespace
export const appId = firebaseConfig.projectId || 'grandmaster-local';

export default app;
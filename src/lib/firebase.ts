import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, type Analytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDyo2mO3V_udQY_KiVrTItXOD3ETSGufAo',
  authDomain: 'familymatters-98d8f.firebaseapp.com',
  projectId: 'familymatters-98d8f',
  storageBucket: 'familymatters-98d8f.firebasestorage.app',
  messagingSenderId: '472637655089',
  appId: '1:472637655089:web:83f2c1599e79f20a20ed10',
  measurementId: 'G-GPLQ4XPXGJ'
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

let analytics: Analytics | null = null;

if (typeof window !== 'undefined') {
  void isAnalyticsSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, auth, analytics, db };


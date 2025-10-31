import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyA32H9UhfNqDfFiM_5yV3DxvLRgYOrQvl4',
  authDomain: 'database-chatbot-ccd72.firebaseapp.com',
  projectId: 'database-chatbot-ccd72',
  storageBucket: 'database-chatbot-ccd72.firebasestorage.app',
  messagingSenderId: '55882749752',
  appId: '1:55882749752:web:fbea45625ce11730f053cd',
  measurementId: 'G-29X9S8G88D',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Analytics (only in browser)
if (typeof window !== 'undefined') {
  try {
    getAnalytics(app);
  } catch (error) {
    console.warn('Analytics initialization failed:', error);
  }
}


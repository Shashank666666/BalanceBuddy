import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBEwrVWaZtJmsX1E5djf0ECN0aiQSDES7g",
    authDomain: "balancebuddy-ff86f.firebaseapp.com",
    projectId: "balancebuddy-ff86f",
    storageBucket: "balancebuddy-ff86f.firebasestorage.app",
    messagingSenderId: "658599798345",
    appId: "1:658599798345:web:bafffee4ff22d58e7cc198",
    measurementId: "G-MBESD825P3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services with persistence
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

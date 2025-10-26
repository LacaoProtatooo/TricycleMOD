// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA8Hq-Kh7GhnX-oLOnMWFVWYlGZeQJDdr4",
  authDomain: "tricyclemod.firebaseapp.com",
  projectId: "tricyclemod",
  storageBucket: "tricyclemod.firebasestorage.app",
  messagingSenderId: "75787064888",
  appId: "1:75787064888:web:65dde6bcf3bae7928e78cd",
  measurementId: "G-FC5J1HFPLY"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app, {
  persistence: ReactNativeAsyncStorage,
});
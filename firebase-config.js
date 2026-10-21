// Replace null with the configuration object from Firebase Console > Project settings > Your apps.
window.TETHER_FIREBASE_CONFIG = // Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDin2Fd86xLBuXKaA2EvdrvXsWSkgdY8y8",
  authDomain: "tether-d7e97.firebaseapp.com",
  projectId: "tether-d7e97",
  storageBucket: "tether-d7e97.firebasestorage.app",
  messagingSenderId: "591429019466",
  appId: "1:591429019466:web:6ddaffba8b8bbf679c43b3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);;

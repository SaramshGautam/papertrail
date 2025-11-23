// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBFhIfTtIuohMRTUM7noKHGXjQac5voTfI",
  authDomain: "papertrail-dbef5.firebaseapp.com",
  projectId: "papertrail-dbef5",
  storageBucket: "papertrail-dbef5.firebasestorage.app",
  // storageBucket: "papertrail-dbef5.appspot.com",
  messagingSenderId: "366155301844",
  appId: "1:366155301844:web:aca62ed9e9ef1fa35a8c41",
  measurementId: "G-CZV59BL29M",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

export const db = getFirestore(app);
export const storage = getStorage(app);

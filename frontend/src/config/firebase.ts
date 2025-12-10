import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAxRCo0yx9hRkQfYXDtzJCla0ZhU8_dK7I",
    authDomain: "calender-ce1f9.firebaseapp.com",
    projectId: "calender-ce1f9",
    storageBucket: "calender-ce1f9.firebasestorage.app",
    messagingSenderId: "847482276670",
    appId: "1:847482276670:web:40e8ad3bd0b0db1543ba6f",
    measurementId: "G-XF5S2F146Y"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
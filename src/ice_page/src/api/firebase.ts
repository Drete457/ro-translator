import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAmaCGz4ULLy8h9RaS0dc1Ti06W6djj7hQ",
  authDomain: "ice-alliance.firebaseapp.com",
  projectId: "ice-alliance",
  storageBucket: "ice-alliance.firebasestorage.app",
  messagingSenderId: "649666956446",
  appId: "1:649666956446:web:d4e9330ddf8d267e30bf8f",
  measurementId: "G-G4WTFDWGYH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const getFirebase = async () => {
  return db;
};

export default getFirebase;

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    serverTimestamp,
    doc, 
    updateDoc, 
    deleteDoc, 
    where 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
   apiKey: "AIzaSyDSXGXsIIDsD-PpyZ08V6NETIhFrpem6HQ",
  authDomain: "cosqun-5b641.firebaseapp.com",
  projectId: "cosqun-5b641",
  storageBucket: "cosqun-5b641.firebasestorage.app",
  messagingSenderId: "374103223478",
  appId: "1:374103223478:web:e490f81d024ad9aa08ca17"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Bütün modulları vahid paket olaraq export edirik ki, app.js rahatlıqla istifadə edə bilsin
export { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc,
    where
};
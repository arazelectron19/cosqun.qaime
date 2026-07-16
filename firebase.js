// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Sənin mövcud Firebase məlumatların bura gəlməlidir
const firebaseConfig = {
    apiKey: "AIzaSyDSXGXsIIDsD-PpyZ08V6NETIhFrpem6HQ",
  authDomain: "cosqun-5b641.firebaseapp.com",
  projectId: "cosqun-5b641",
  storageBucket: "cosqun-5b641.firebasestorage.app",
  messagingSenderId: "374103223478",
  appId: "1:374103223478:web:e490f81d024ad9aa08ca17"
};

// İnitializasiya
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Digər fayllarda istifadə edə bilmək üçün hamısını export edirik
export { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    serverTimestamp 
};
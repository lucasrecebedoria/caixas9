// Firebase bootstrap (compat SDK for simplicity)
const firebaseConfig = {
  apiKey: "AIzaSyC9L4GAbCGX9ySB_SYUJYjTKLmaw8bEXBc",
  authDomain: "lancamentocaixas.firebaseapp.com",
  projectId: "lancamentocaixas",
  storageBucket: "lancamentocaixas.firebasestorage.app",
  messagingSenderId: "559411456318",
  appId: "1:559411456318:web:d0525546d96302e124e46f",
  measurementId: "G-3S6K5X5WYJ"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

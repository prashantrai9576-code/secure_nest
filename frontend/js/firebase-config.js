// ================================================
// firebase-config.js – Firebase SDK Initialization
// ================================================

const firebaseConfig = {
  apiKey:            "AIzaSyDs6vkqGfuJWho0nzgyuDVes2GMTttLSTg", // Keeping your existing API key
  authDomain:        "nest-61a74.firebaseapp.com",
  projectId:         "nest-61a74",
  storageBucket:     "nest-61a74.firebasestorage.app",
  messagingSenderId: "364107426144",
  appId:             "1:364107426144:web:5353a90d575c82f7361605",
  measurementId:     "G-S40FHWX5QS",
  databaseURL:       "https://nest-61a74-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export references
const auth = firebase.auth();
const db   = firebase.database();

// TUNE CONNECTION (Fixes "flapping" issue)
db.goOnline();

const analytics = firebase.analytics ? firebase.analytics() : null;

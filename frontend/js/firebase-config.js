// ================================================
// firebase-config.js – Firebase SDK Initialization
// ================================================

const firebaseConfig = {
  apiKey:            "AIzaSyDs6vkqGfuJWho0nzgyuDVes2GMTttLSTg",
  authDomain:        "nest-901c8.firebaseapp.com",
  projectId:         "nest-901c8",
  storageBucket:     "nest-901c8.firebasestorage.app",
  messagingSenderId: "364107426144",
  appId:             "1:364107426144:web:5353a90d575c82f7361605",
  measurementId:     "G-S40FHWX5QS",
  databaseURL:       "https://nest-901c8-default-rtdb.firebaseio.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export references
const auth = firebase.auth();
const db   = firebase.database();
const analytics = firebase.analytics ? firebase.analytics() : null;

// ── Firebase Configuration ──────────────────────────────────────────
// Ram Naam Counter Firebase Config
// Project: ramnamcounter

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCC0b0va2g4yApam0gxcPqycbEb6yYyOhY",
  authDomain: "ramnamcounter.firebaseapp.com",
  projectId: "ramnamcounter",
  storageBucket: "ramnamcounter.firebasestorage.app",
  messagingSenderId: "732332928351",
  appId: "1:732332928351:web:8e1c67987e10399edd9aea",
  measurementId: "G-8J07N337VX"
};

// Allow config override from localStorage if set via UI
let savedConfig = null;
try {
  const stored = localStorage.getItem('ram_custom_firebase_config');
  if (stored) savedConfig = JSON.parse(stored);
} catch (e) {}

window.FIREBASE_CONFIG = savedConfig || DEFAULT_FIREBASE_CONFIG;
window.isFirebaseConfigured = function() {
  const cfg = window.FIREBASE_CONFIG;
  return Boolean(cfg && cfg.apiKey && cfg.projectId && cfg.apiKey !== "" && cfg.projectId !== "");
};

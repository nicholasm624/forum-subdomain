// ── Firebase Initialization (CDN compat mode) ──
// Loaded after Firebase SDK compat scripts

(function() {
  firebase.initializeApp(window.FIREBASE_CONFIG);
  window.db = firebase.firestore();
  window.auth = firebase.auth();
})();

// ── Authentication Service (Compat API) ──

(function() {
  "use strict";

  // ── Sign Up ──
  window.authSignUp = async function(email, password, displayName) {
    const cred = await window.auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName });

    // Create profile in Firestore
    await window.db.collection("users").doc(cred.user.uid).set({
      displayName: displayName,
      email: email,
      role: "member",
      avatarColor: getRandomAvatarColor(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastActive: firebase.firestore.FieldValue.serverTimestamp(),
      threadCount: 0,
      replyCount: 0
    });

    return cred.user;
  };

  // ── Sign In ──
  window.authSignIn = async function(email, password) {
    const cred = await window.auth.signInWithEmailAndPassword(email, password);
    await window.db.collection("users").doc(cred.user.uid).update({
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });
    return cred.user;
  };

  // ── Anonymous Sign In ──
  window.authSignInAnonymously = async function() {
    const cred = await window.auth.signInAnonymously();

    // Create minimal anonymous profile
    await window.db.collection("users").doc(cred.user.uid).set({
      displayName: "Anonymous",
      email: null,
      role: "anonymous",
      avatarColor: getRandomAvatarColor(),
      isAnonymous: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastActive: firebase.firestore.FieldValue.serverTimestamp(),
      threadCount: 0,
      replyCount: 0
    });

    return cred.user;
  };

  // ── Link Anonymous to Email Account ──
  window.authLinkAccount = async function(email, password, displayName) {
    const user = window.auth.currentUser;
    if (!user || !user.isAnonymous) {
      throw new Error("No anonymous user to link");
    }

    const credential = firebase.auth.EmailAuthProvider.credential(email, password);
    const result = await user.linkWithCredential(credential);

    // Update profile
    await window.db.collection("users").doc(result.user.uid).update({
      displayName: displayName,
      email: email,
      role: "member",
      isAnonymous: false,
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });

    return result.user;
  };

  // ── Sign Out ──
  window.authSignOut = async function() {
    return window.auth.signOut();
  };

  // ── Password Reset ──
  window.authResetPassword = async function(email) {
    return window.auth.sendPasswordResetEmail(email);
  };

  // ── Auth State Listener ──
  window.onAuthStateChange = function(callback) {
    return window.auth.onAuthStateChanged(async function(user) {
      if (user && !user.isAnonymous) {
        const doc = await window.db.collection("users").doc(user.uid).get();
        const profile = doc.exists ? doc.data() : null;
        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          profile: profile,
          isAuthenticated: true,
          isAnonymous: false
        });
      } else if (user && user.isAnonymous) {
        const doc = await window.db.collection("users").doc(user.uid).get();
        const profile = doc.exists ? doc.data() : null;
        callback({
          uid: user.uid,
          displayName: "Anonymous",
          profile: profile,
          isAuthenticated: true,
          isAnonymous: true
        });
      } else {
        callback({
          isAuthenticated: false,
          isAnonymous: false
        });
      }
    });
  };

  // ── Get Current User ──
  window.getCurrentUser = function() {
    return window.auth.currentUser;
  };

  // ── Helper: Random avatar color ──
  function getRandomAvatarColor() {
    var colors = ['#FF5515','#7C3AED','#059669','#D97706','#DC2626','#0284C7','#DB2777','#65A30D'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

})();

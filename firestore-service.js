// ── Firestore Database Service (Compat API) ──

(function() {
  "use strict";

  var db = window.db;
  var firebase = window.firebase;

  // ── CATEGORIES ──
  window.getCategories = function(callback) {
    return db.collection("categories")
      .orderBy("displayOrder")
      .onSnapshot(function(snapshot) {
        var categories = [];
        snapshot.forEach(function(doc) {
          categories.push({ id: doc.id, ...doc.data() });
        });
        callback(categories);
      });
  };

  window.createCategory = async function(categoryData) {
    return db.collection("categories").add({
      ...categoryData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  };

  // ── THREADS ──
  window.getThreads = function(callback) {
    return db.collection("threads")
      .orderBy("createdAt", "desc")
      .onSnapshot(function(snapshot) {
        var threads = [];
        snapshot.forEach(function(doc) {
          threads.push({ id: doc.id, ...doc.data() });
        });
        callback(threads);
      });
  };

  window.getThreadsOrdered = function(callback) {
    return db.collection("threads")
      .orderBy("pinned", "desc")
      .orderBy("createdAt", "desc")
      .onSnapshot(function(snapshot) {
        var threads = [];
        snapshot.forEach(function(doc) {
          threads.push({ id: doc.id, ...doc.data() });
        });
        callback(threads);
      });
  };

  window.getThreadsByCategory = function(categoryId, callback) {
    return db.collection("threads")
      .where("categoryId", "==", categoryId)
      .orderBy("createdAt", "desc")
      .onSnapshot(function(snapshot) {
        var threads = [];
        snapshot.forEach(function(doc) {
          threads.push({ id: doc.id, ...doc.data() });
        });
        callback(threads);
      });
  };

  window.getThread = async function(threadId) {
    var doc = await db.collection("threads").doc(threadId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  };

  window.createThread = async function(threadData) {
    return db.collection("threads").add({
      ...threadData,
      replyCount: 0,
      viewCount: 1,
      pinned: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  };

  window.updateThread = async function(threadId, updates) {
    return db.collection("threads").doc(threadId).update({
      ...updates,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  };

  window.incrementViewCount = async function(threadId) {
    return db.collection("threads").doc(threadId).update({
      viewCount: firebase.firestore.FieldValue.increment(1)
    });
  };

  window.deleteThread = async function(threadId) {
    var replies = await db.collection("replies").where("threadId", "==", threadId).get();
    var batch = db.batch();
    replies.forEach(function(doc) { batch.delete(doc.ref); });
    batch.delete(db.collection("threads").doc(threadId));
    return batch.commit();
  };

  // ── REPLIES ──
  window.getRepliesForThread = function(threadId, callback) {
    return db.collection("replies")
      .where("threadId", "==", threadId)
      .orderBy("createdAt", "asc")
      .onSnapshot(function(snapshot) {
        var replies = [];
        snapshot.forEach(function(doc) {
          replies.push({ id: doc.id, ...doc.data() });
        });
        callback(replies);
      });
  };

  window.createReply = async function(replyData) {
    var replyRef = await db.collection("replies").add({
      ...replyData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    db.collection("threads").doc(replyData.threadId).update({
      replyCount: firebase.firestore.FieldValue.increment(1),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return replyRef;
  };

  window.deleteReply = async function(replyId, threadId) {
    await db.collection("replies").doc(replyId).delete();
    return db.collection("threads").doc(threadId).update({
      replyCount: firebase.firestore.FieldValue.increment(-1)
    });
  };

  // ── REPORTS (Moderation) ──
  window.createReport = async function(reportData) {
    return db.collection("reports").add({
      ...reportData,
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  };

  window.getReports = function(callback) {
    return db.collection("reports")
      .orderBy("createdAt", "desc")
      .onSnapshot(function(snapshot) {
        var reports = [];
        snapshot.forEach(function(doc) {
          reports.push({ id: doc.id, ...doc.data() });
        });
        callback(reports);
      });
  };

  window.updateReport = async function(reportId, updates) {
    return db.collection("reports").doc(reportId).update(updates);
  };

  // ── USER PROFILE ──
  window.saveUserProfile = async function(userId, profileData) {
    return db.collection("users").doc(userId).update({
      ...profileData,
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });
  };

  window.getUserProfile = async function(userId) {
    var doc = await db.collection("users").doc(userId).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  };

  // ── RATE LIMIT CHECK ──
  window.checkRateLimit = async function(userId, action, limitMinutes, maxActions) {
    if (!userId) return false;

    var now = new Date();
    var cutoff = new Date(now.getTime() - limitMinutes * 60000);

    var queryField = action === "thread" ? "authorId" : "authorId";
    var collection = action === "thread" ? "threads" : "replies";
    var field = action === "thread" ? "createdAt" : "createdAt";

    var snapshot = await db.collection(collection)
      .where(queryField, "==", userId)
      .where(field, ">=", cutoff)
      .get();

    return snapshot.size < maxActions;
  };

})();

// ── Firebase Firestore Security Rules ──
// Deploy these rules in the Firebase Console:
// Firebase Console → Firestore Database → Rules tab
// Paste the rules below and click "Publish"

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helper Functions ──
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    function isAdmin() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isModerator() {
      return isAuthenticated() &&
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'moderator' ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }

    // ── USERS Collection ──
    match /users/{userId} {
      // Anyone can read user profiles
      allow read: if true;

      // Users can create their own profile (only during signup)
      allow create: if isOwner(userId) &&
        request.resource.data.displayName is string &&
        request.resource.data.email is string &&
        request.resource.data.role == 'member'; // Prevent self-assigning admin/moderator

      // Users can update their own profile (but not role)
      allow update: if isOwner(userId) &&
        request.resource.data.role == resource.data.role; // Role cannot be changed by user

      // Only admins can delete users
      allow delete: if isAdmin();
    }

    // ── CATEGORIES Collection ──
    match /categories/{categoryId} {
      // Anyone can read categories
      allow read: if true;

      // Only admins can create, update, delete categories
      allow create, update, delete: if isAdmin();
    }

    // ── THREADS Collection ──
    match /threads/{threadId} {
      // Anyone can read threads
      allow read: if true;

      // Authenticated users can create threads
      allow create: if isAuthenticated() &&
        request.resource.data.title is string &&
        request.resource.data.title.size() > 0 &&
        request.resource.data.title.size() <= 200 &&
        request.resource.data.content is string &&
        request.resource.data.content.size() > 0 &&
        request.resource.data.categoryId is string &&
        request.resource.data.authorId == request.auth.uid &&
        request.resource.data.authorName is string;

      // Thread authors, moderators, and admins can update
      allow update: if isAuthenticated() &&
        (isOwner(resource.data.authorId) || isModerator());

      // Only moderators and admins can delete threads
      allow delete: if isModerator();
    }

    // ── REPLIES Collection ──
    match /replies/{replyId} {
      // Anyone can read replies
      allow read: if true;

      // Authenticated users can create replies
      allow create: if isAuthenticated() &&
        request.resource.data.content is string &&
        request.resource.data.content.size() > 0 &&
        request.resource.data.content.size() <= 5000 &&
        request.resource.data.threadId is string &&
        request.resource.data.authorId == request.auth.uid &&
        request.resource.data.authorName is string;

      // Reply authors, moderators, and admins can update
      allow update: if isAuthenticated() &&
        (isOwner(resource.data.authorId) || isModerator());

      // Reply authors, moderators, and admins can delete
      allow delete: if isAuthenticated() &&
        (isOwner(resource.data.authorId) || isModerator());
    }

  }
}

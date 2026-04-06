# RecUnited Forum — Firebase Backend Setup Guide

## Overview
The forum uses **Firebase** for:
- **Authentication** — Email/password login & signup
- **Firestore Database** — Threads, replies, categories, user profiles
- **Real-time updates** — Live thread/reply updates via `onSnapshot`

---

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project**
3. Name it (e.g., `recunited-forum`)
4. Disable Google Analytics (not needed)
5. Click **Create project**

---

## Step 2: Enable Authentication

1. In Firebase Console → **Build** → **Authentication**
2. Click **Get started**
3. Under **Sign-in method**, enable **Email/Password**
4. Click **Save**

---

## Step 3: Create Firestore Database

1. In Firebase Console → **Build** → **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (we'll apply security rules next)
4. Select a location closest to your users
5. Click **Enable**

---

## Step 4: Deploy Security Rules

1. Go to **Firestore Database** → **Rules** tab
2. Copy the contents of `firestore.rules` and paste it
3. Click **Publish**

> **Important:** Test mode allows anyone to read/write. The security rules restrict this properly.

---

## Step 5: Create Indexes

1. Go to **Firestore Database** → **Indexes** tab
2. Click **Create Index** for each composite index needed, OR
3. Use the Firebase CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore
   ```
4. Copy `firestore-indexes.json` contents into your `firestore.indexes.json`
5. Deploy: `firebase deploy --only firestore:indexes`

**Manual indexes to create:**
- `threads`: `categoryId` ASC + `createdAt` DESC
- `threads`: `pinned` DESC + `createdAt` DESC
- `replies`: `threadId` ASC + `createdAt` ASC
- `categories`: `displayOrder` ASC

---

## Step 6: Get Your Config

1. Go to **Project Settings** (gear icon)
2. Under **Your apps**, click the **Web** icon (`</>`)
3. Register the app (e.g., "RecUnited Forum")
4. Copy the `firebaseConfig` object

---

## Step 7: Update `firebase-config.js`

Open `firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",           // Your actual API key
  authDomain: "recunited-forum.firebaseapp.com",
  projectId: "recunited-forum",
  storageBucket: "recunited-forum.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## Step 8: Create an Admin User

After signing up your first account, you need to manually set the role to `admin` in Firestore:

1. Go to **Firestore Database** → **Data**
2. Find the `users` collection
3. Find your user document
4. Change `role` from `"member"` to `"admin"`
5. Click **Update**

Admins can:
- Create/edit/delete categories
- Delete any thread or reply
- Moderate content

To create moderators, set `role` to `"moderator"`.

---

## Step 9: Seed Default Categories (Automatic)

The first time you load `forum.html`, it will automatically create these default categories:
- 💬 General Discussion
- 🔧 Development Updates
- 🎮 Game Modes & Rooms

You can customize these later from the Firestore console or build an admin panel.

---

## Step 10: Run a Local Server

Because the JS modules use `import`, you **must** serve the files over HTTP (not `file://`):

```bash
# Option 1: Python
python3 -m http.server 8000

# Option 2: Node.js
npx serve .

# Option 3: VS Code — use "Live Server" extension
```

Then open: `http://localhost:8000/forum.html`

---

## Database Schema

```
users/
  {userId}/
    displayName: string
    email: string
    role: "member" | "moderator" | "admin"
    avatarColor: string
    createdAt: timestamp
    lastActive: timestamp
    threadCount: number
    replyCount: number

categories/
  {categoryId}/
    name: string
    description: string
    icon: string (emoji)
    displayOrder: number
    createdAt: timestamp

threads/
  {threadId}/
    title: string
    content: string
    categoryId: string (ref to categories)
    authorId: string (ref to users)
    authorName: string
    authorColor: string
    replyCount: number
    viewCount: number
    pinned: boolean
    createdAt: timestamp
    updatedAt: timestamp

replies/
  {replyId}/
    threadId: string (ref to threads)
    content: string
    authorId: string (ref to users)
    authorName: string
    authorColor: string
    createdAt: timestamp
```

---

## Firebase Hosting (Optional — Deploy to Production)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

Select your project, set `public directory` to the root (`.`), and configure as a single-page app.

Then deploy:
```bash
firebase deploy --only hosting
```

Your forum will be live at `https://your-project.web.app`

---

## Troubleshooting

**"Module not found" errors:** Make sure you're running a local server, not opening files directly.

**"Permission denied" errors:** Check that security rules are deployed and the user is authenticated.

**Threads not loading:** Check Firebase Console → Firestore → make sure categories exist. The auto-seed only runs if the collection is empty.

**CORS errors:** Make sure all file paths are correct and the server is running from the project root.

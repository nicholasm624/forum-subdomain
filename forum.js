// ── Forum Logic with Firebase (Compat API) ──

(function() {
  "use strict";

  // ── Global State ──
  var currentUser = null;
  var allCategories = [];
  var allThreads = [];
  var currentThreadId = null;
  var categoriesUnsub = null;
  var threadsUnsub = null;
  var repliesUnsub = null;

  // ── Auth State Listener ──
  onAuthStateChange(function(user) {
    currentUser = user;
    updateAuthUI();
    updateAdminButton();
  });

  // Show/hide admin button based on role
  function updateAdminButton() {
    var adminBtn = document.getElementById('admin-panel-btn');
    var navAdminLink = document.getElementById('nav-admin-link');
    
    if (currentUser && currentUser.isAuthenticated && currentUser.profile && currentUser.profile.role === 'admin') {
      if (adminBtn) adminBtn.style.display = 'inline-block';
      if (navAdminLink) navAdminLink.style.display = 'block';
    } else {
      if (adminBtn) adminBtn.style.display = 'none';
      if (navAdminLink) navAdminLink.style.display = 'none';
    }
  }

  // ── Auth UI ──
  function updateAuthUI() {
    var container = document.getElementById('auth-container');
    if (!container) return;

    if (currentUser && currentUser.isAuthenticated && !currentUser.isAnonymous) {
      var color = (currentUser.profile && currentUser.profile.avatarColor) || '#FF5515';
      container.innerHTML =
        '<div class="auth-user-info">' +
          '<div class="auth-avatar" style="background:' + color + ';">' +
            '<div class="av-inner" style="color:' + color + ';"></div>' +
          '</div>' +
          '<span class="auth-username">' + escapeHtml(currentUser.displayName || currentUser.email) + '</span>' +
          '<button class="btn-auth-logout" onclick="handleLogout()">Logout</button>' +
        '</div>';
    } else if (currentUser && currentUser.isAuthenticated && currentUser.isAnonymous) {
      container.innerHTML =
        '<div class="auth-user-info">' +
          '<div class="auth-avatar" style="background:#999;">' +
            '<div class="av-inner" style="color:#999;"></div>' +
          '</div>' +
          '<span class="auth-username">Anonymous</span>' +
          '<button class="btn-orange btn-sm" onclick="openLinkAccountModal()">Link Account</button>' +
          '<button class="btn-auth-logout" onclick="handleLogout()">Leave</button>' +
        '</div>';
    } else {
      container.innerHTML =
        '<button class="btn-outline btn-sm" onclick="openAuthModal(\'login\')">Login</button>' +
        '<button class="btn-orange btn-sm" onclick="openAuthModal(\'signup\')">Sign Up</button>' +
        '<button class="btn-text" onclick="handleAnonymousSignIn()">Browse as Guest</button>';
    }
  }

  // ── Anonymous Browse ──
  window.handleAnonymousSignIn = async function() {
    try {
      await authSignInAnonymously();
    } catch (error) {
      console.error("Anonymous sign-in error:", error);
      alert("Could not start guest session. Please try again.");
    }
  };

  // ── Link Account ──
  window.openLinkAccountModal = function() {
    document.getElementById('link-email').value = '';
    document.getElementById('link-password').value = '';
    document.getElementById('link-displayname').value = '';
    document.getElementById('link-error').style.display = 'none';
    document.getElementById('link-account-modal').classList.add('active');
  };

  window.closeLinkAccountModal = function() {
    document.getElementById('link-account-modal').classList.remove('active');
  };

  window.handleLinkAccount = async function(event) {
    event.preventDefault();
    var email = document.getElementById('link-email').value.trim();
    var password = document.getElementById('link-password').value;
    var displayName = document.getElementById('link-displayname').value.trim();
    var errorEl = document.getElementById('link-error');

    if (password.length < 6) {
      errorEl.textContent = "Password must be at least 6 characters.";
      errorEl.style.display = 'block';
      return;
    }

    try {
      await authLinkAccount(email, password, displayName);
      closeLinkAccountModal();
    } catch (error) {
      console.error("Link error:", error);
      if (error.code === 'auth/email-already-in-use') {
        errorEl.textContent = "This email is already registered to another account.";
      } else if (error.code === 'auth/invalid-email') {
        errorEl.textContent = "Invalid email address.";
      } else if (error.code === 'auth/weak-password') {
        errorEl.textContent = "Password must be at least 6 characters.";
      } else {
        errorEl.textContent = "Failed to link account. Please try again.";
      }
      errorEl.style.display = 'block';
    }
  };

  // ── Load Categories ──
  function loadCategories() {
    seedDefaultCategories();
    categoriesUnsub = getCategories(function(categories) {
      if (categories && categories.length > 0) {
        allCategories = categories;
      } else {
        // Fallback: use default categories if Firestore is empty
        allCategories = getDefaultCategories();
      }
      renderForum();
      populateCategoryDropdown();
    });
  }

  function getDefaultCategories() {
    return [
      { id: 'general', name: "General Discussion", description: "Chat about anything RecUnited", displayOrder: 1, icon: "\uD83D\uDCAC" },
      { id: 'dev', name: "Development Updates", description: "Official updates from the dev team", displayOrder: 2, icon: "\uD83D\uDD27" },
      { id: 'modes', name: "Game Modes & Rooms", description: "Discuss game modes and custom rooms", displayOrder: 3, icon: "\uD83C\uDFAE" }
    ];
  }

  function populateCategoryDropdown() {
    var select = document.getElementById('thread-category-input');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select a category...</option>';
    allCategories.forEach(function(cat) {
      var opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      select.appendChild(opt);
    });
  }

  async function seedDefaultCategories() {
    try {
      var snapshot = await db.collection("categories").get();
      if (snapshot.empty) {
        // Only admins can create categories in Firestore
        // This will silently fail for non-admins, which is expected
        var defaults = [
          { name: "General Discussion", description: "Chat about anything RecUnited", displayOrder: 1, icon: "\uD83D\uDCAC" },
          { name: "Development Updates", description: "Official updates from the dev team", displayOrder: 2, icon: "\uD83D\uDD27" },
          { name: "Game Modes & Rooms", description: "Discuss game modes and custom rooms", displayOrder: 3, icon: "\uD83C\uDFAE" }
        ];
        for (var i = 0; i < defaults.length; i++) {
          try {
            defaults[i].createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection("categories").add(defaults[i]);
          } catch (err) {
            console.log("Failed to seed category:", defaults[i].name, err.message);
          }
        }
      }
    } catch (error) {
      console.log("Category seeding skipped (requires admin permissions):", error.message);
    }
  }

  // ── Load Threads ──
  function loadThreads() {
    threadsUnsub = getThreadsOrdered(function(threads) {
      allThreads = threads;
      renderForum();
    });
  }

  // ── Render Forum ──
  function renderForum() {
    var container = document.getElementById('forum-container');
    if (!container) return;

    var html = '';

    allCategories.forEach(function(category) {
      var catThreads = allThreads.filter(function(t) { return t.categoryId === category.id; });

      html += '<div class="forum-category">' +
        '<div class="category-header">' +
          '<h2>' + (category.icon || '') + ' ' + escapeHtml(category.name) + '</h2>' +
          '<span class="category-count">' + catThreads.length + ' thread' + (catThreads.length !== 1 ? 's' : '') + '</span>' +
        '</div>' +
        '<p class="category-description">' + escapeHtml(category.description || '') + '</p>' +
        '<div class="forum-threads">';

      if (catThreads.length === 0) {
        html += '<div class="empty-category"><p>No threads yet. Be the first to start a discussion!</p></div>';
      } else {
        catThreads.forEach(function(thread) {
          var created = thread.createdAt ? formatDate(thread.createdAt) : 'Just now';
          html += '<div class="thread-card" onclick="window.openThread(\'' + thread.id + '\')">' +
            '<div class="thread-avatar" style="background:' + (thread.authorColor || '#FF5515') + ';">' +
              '<div class="av-inner" style="color:' + (thread.authorColor || '#FF5515') + ';"></div>' +
            '</div>' +
            '<div class="thread-content">' +
              '<div class="thread-title">' + (thread.pinned ? '\uD83D\uDCCC ' : '') + escapeHtml(thread.title) + '</div>' +
              '<div class="thread-meta">' +
                '<span class="thread-author">' + escapeHtml(thread.authorName) + '</span>' +
                '<span class="thread-date">' + created + '</span>' +
              '</div>' +
              '<div class="thread-tags">' +
                (thread.pinned ? '<span class="tag tag-pinned">Pinned</span>' : '') +
                '<span class="tag tag-' + (category.id || 'general') + '">' + escapeHtml(category.name) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="thread-stats">' +
              '<div class="thread-stat"><span class="thread-stat-n">' + (thread.replyCount || 0) + '</span><div class="thread-stat-l">Replies</div></div>' +
              '<div class="thread-stat"><span class="thread-stat-n">' + (thread.viewCount || 0) + '</span><div class="thread-stat-l">Views</div></div>' +
            '</div>' +
          '</div>';
        });
      }

      html += '</div></div>';
    });

    container.innerHTML = html;
  }

  // ── Open Thread Detail ──
  window.openThread = async function(threadId) {
    currentThreadId = threadId;
    var modal = document.getElementById('thread-detail-modal');
    var titleEl = document.getElementById('thread-detail-title');
    var bodyEl = document.getElementById('thread-detail-body');

    incrementViewCount(threadId);

    var thread = await getThread(threadId);
    if (!thread) return;

    titleEl.textContent = thread.title;

    var html = '<div class="thread-post">' +
      '<div class="thread-post-header">' +
        '<div class="post-avatar" style="background:' + (thread.authorColor || '#FF5515') + ';">' +
          '<div class="av-inner" style="color:' + (thread.authorColor || '#FF5515') + ';"></div>' +
        '</div>' +
        '<div>' +
          '<div class="post-author">' + escapeHtml(thread.authorName) + '</div>' +
          '<div class="post-date">' + (thread.createdAt ? formatDate(thread.createdAt) : 'Just now') + '</div>' +
        '</div>' +
        '<button class="btn-report" onclick="openReportModal(\'' + thread.id + '\', \'thread\')">\uD83D\uDEA9 Report</button>' +
      '</div>' +
      '<div class="post-body">' + escapeHtml(thread.content).replace(/\n/g, '<br>') + '</div>' +
    '</div>';

    bodyEl.innerHTML = html + '<div class="loading-replies">Loading replies...</div>';
    modal.classList.add('active');

    // Load replies
    if (repliesUnsub) repliesUnsub();

    repliesUnsub = getRepliesForThread(threadId, function(replies) {
      var repliesHtml = replies.map(function(reply) {
        return '<div class="thread-post">' +
          '<div class="thread-post-header">' +
            '<div class="post-avatar" style="background:' + (reply.authorColor || '#7C3AED') + ';">' +
              '<div class="av-inner" style="color:' + (reply.authorColor || '#7C3AED') + ';"></div>' +
            '</div>' +
            '<div>' +
              '<div class="post-author">' + escapeHtml(reply.authorName) + '</div>' +
              '<div class="post-date">' + (reply.createdAt ? formatDate(reply.createdAt) : 'Just now') + '</div>' +
            '</div>' +
            '<button class="btn-report" onclick="openReportModal(\'' + reply.id + '\', \'reply\')">\uD83D\uDEA9 Report</button>' +
          '</div>' +
          '<div class="post-body">' + escapeHtml(reply.content).replace(/\n/g, '<br>') + '</div>' +
        '</div>';
      }).join('');

      var canReply = currentUser && currentUser.isAuthenticated;
      var replyBox = '<div class="reply-box">' +
        '<textarea id="reply-input" rows="4" placeholder="' + (canReply ? 'Write your reply...' : 'Please sign in to reply') + '"' + (!canReply ? ' disabled' : '') + '></textarea>' +
        '<button class="btn-orange" onclick="window.submitReply(\'' + threadId + '\')"' + (!canReply ? ' disabled style="opacity:0.5;cursor:not-allowed;"' : '') + '>Post Reply</button>' +
      '</div>';

      bodyEl.innerHTML = html + repliesHtml + replyBox;
    });
  };

  window.closeThreadDetail = function() {
    document.getElementById('thread-detail-modal').classList.remove('active');
    if (repliesUnsub) { repliesUnsub(); repliesUnsub = null; }
    currentThreadId = null;
  };

  // ── Submit Reply ──
  window.submitReply = async function(threadId) {
    if (!currentUser || !currentUser.isAuthenticated) {
      alert('Please sign in to reply.');
      return;
    }

    var input = document.getElementById('reply-input');
    var text = input.value.trim();
    if (!text) return;

    // Rate limit check
    var allowed = await checkRateLimit(currentUser.uid, "reply", 5, 10);
    if (!allowed) {
      alert('You are posting too quickly. Please wait a few minutes.');
      return;
    }

    try {
      await createReply({
        threadId: threadId,
        content: text,
        authorId: currentUser.uid,
        authorName: currentUser.isAnonymous ? 'Anonymous' : (currentUser.displayName || currentUser.email),
        authorColor: (currentUser.profile && currentUser.profile.avatarColor) || '#FF5515',
        isAnonymous: currentUser.isAnonymous || false
      });
      input.value = '';
    } catch (error) {
      console.error("Reply error:", error);
      alert('Failed to post reply. Please try again.');
    }
  };

  // ── New Thread Modal ──
  window.openNewThreadModal = async function() {
    if (!currentUser || !currentUser.isAuthenticated) {
      alert('Please sign in to create a thread.');
      openAuthModal('login');
      return;
    }

    // Rate limit check
    try {
      var allowed = await checkRateLimit(currentUser.uid, "thread", 5, 5);
      if (!allowed) {
        alert('You are creating threads too quickly. Please wait a few minutes.');
        return;
      }
    } catch (error) {
      console.warn("Rate limit check failed, allowing thread creation:", error);
    }

    // Populate categories
    populateCategoryDropdown();

    document.getElementById('new-thread-modal').classList.add('active');
  };

  window.closeNewThreadModal = function() {
    document.getElementById('new-thread-modal').classList.remove('active');
    document.getElementById('new-thread-form').reset();
  };

  window.submitThread = async function(event) {
    event.preventDefault();

    if (!currentUser || !currentUser.isAuthenticated) {
      alert('Please sign in to create a thread.');
      return;
    }

    var title = document.getElementById('thread-title-input').value.trim();
    var categoryId = document.getElementById('thread-category-input').value;
    var body = document.getElementById('thread-body-input').value.trim();

    if (!title || !categoryId || !body) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      await createThread({
        title: title,
        content: body,
        categoryId: categoryId,
        authorId: currentUser.uid,
        authorName: currentUser.isAnonymous ? 'Anonymous' : (currentUser.displayName || currentUser.email),
        authorColor: (currentUser.profile && currentUser.profile.avatarColor) || '#FF5515',
        isAnonymous: currentUser.isAnonymous || false
      });
      closeNewThreadModal();
    } catch (error) {
      console.error("Thread error:", error);
      alert('Failed to create thread: ' + (error.message || 'Please try again.'));
    }
  };

  // ── Auth Modal ──
  window.openAuthModal = function(mode) {
    var loginForm = document.getElementById('login-form');
    var signupForm = document.getElementById('signup-form');

    if (mode === 'login') {
      loginForm.style.display = 'block';
      signupForm.style.display = 'none';
    } else {
      loginForm.style.display = 'none';
      signupForm.style.display = 'block';
    }

    document.getElementById('auth-modal-title').textContent = mode === 'login' ? 'Login' : 'Sign Up';
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('signup-error').style.display = 'none';
    document.getElementById('auth-modal').classList.add('active');
  };

  window.closeAuthModal = function() {
    document.getElementById('auth-modal').classList.remove('active');
    document.getElementById('login-form').reset();
    document.getElementById('signup-form').reset();
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('signup-error').style.display = 'none';
  };

  window.switchAuthMode = function(mode) {
    openAuthModal(mode);
  };

  window.handleLogin = async function(event) {
    event.preventDefault();
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    var errEl = document.getElementById('login-error');

    try {
      await authSignIn(email, password);
      closeAuthModal();
    } catch (error) {
      var msg = 'Failed to login. Please check your credentials.';
      if (error.code === 'auth/user-not-found') msg = 'No account found with this email.';
      if (error.code === 'auth/wrong-password') msg = 'Incorrect password.';
      if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
      if (error.code === 'auth/too-many-requests') msg = 'Too many failed attempts. Please try again later.';
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }
  };

  window.handleSignup = async function(event) {
    event.preventDefault();
    var displayName = document.getElementById('signup-name').value.trim();
    var email = document.getElementById('signup-email').value.trim();
    var password = document.getElementById('signup-password').value;
    var confirm = document.getElementById('signup-confirm').value;
    var errEl = document.getElementById('signup-error');

    if (password !== confirm) {
      errEl.textContent = 'Passwords do not match.';
      errEl.style.display = 'block';
      return;
    }
    if (password.length < 6) {
      errEl.textContent = 'Password must be at least 6 characters.';
      errEl.style.display = 'block';
      return;
    }

    try {
      await authSignUp(email, password, displayName);
      closeAuthModal();
    } catch (error) {
      var msg = 'Failed to create account.';
      if (error.code === 'auth/email-already-in-use') msg = 'This email is already registered.';
      if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
      if (error.code === 'auth/weak-password') msg = 'Password must be at least 6 characters.';
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }
  };

  window.handleLogout = async function() {
    try {
      await authSignOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  window.handlePasswordReset = async function() {
    var email = document.getElementById('login-email').value.trim();
    if (!email) {
      var errEl = document.getElementById('login-error');
      errEl.textContent = 'Enter your email first, then click "Forgot Password".';
      errEl.style.display = 'block';
      return;
    }
    try {
      await authResetPassword(email);
      var errEl = document.getElementById('login-error');
      errEl.textContent = 'Password reset email sent! Check your inbox.';
      errEl.style.display = 'block';
      errEl.style.color = 'var(--orange)';
    } catch (error) {
      var errEl = document.getElementById('login-error');
      errEl.textContent = 'Failed to send reset email.';
      errEl.style.display = 'block';
    }
  };

  // ── Moderation: Report Modal ──
  window.openReportModal = function(targetId, targetType) {
    document.getElementById('report-target-id').value = targetId;
    document.getElementById('report-target-type').value = targetType;
    document.getElementById('report-reason').value = '';
    document.getElementById('report-error').style.display = 'none';
    document.getElementById('report-modal').classList.add('active');
  };

  window.closeReportModal = function() {
    document.getElementById('report-modal').classList.remove('active');
  };

  window.submitReport = async function(event) {
    event.preventDefault();

    if (!currentUser || !currentUser.isAuthenticated) {
      alert('Please sign in to report content.');
      return;
    }

    var targetId = document.getElementById('report-target-id').value;
    var targetType = document.getElementById('report-target-type').value;
    var reason = document.getElementById('report-reason').value.trim();

    if (!reason) {
      document.getElementById('report-error').textContent = 'Please provide a reason.';
      document.getElementById('report-error').style.display = 'block';
      return;
    }

    try {
      await createReport({
        targetId: targetId,
        targetType: targetType,
        reason: reason,
        reporterId: currentUser.uid,
        reporterName: currentUser.isAnonymous ? 'Anonymous' : (currentUser.displayName || currentUser.email)
      });
      closeReportModal();
      alert('Report submitted. Moderators will review it shortly.');
    } catch (error) {
      console.error("Report error:", error);
      document.getElementById('report-error').textContent = 'Failed to submit report.';
      document.getElementById('report-error').style.display = 'block';
    }
  };

  // ── Moderation: Admin Panel ──
  window.openModerationPanel = async function() {
    if (!currentUser || !currentUser.isAuthenticated || (currentUser.profile && currentUser.profile.role !== 'admin' && currentUser.profile.role !== 'moderator')) {
      alert('You do not have permission to access the moderation panel.');
      return;
    }

    document.getElementById('mod-panel').classList.add('active');
    loadReports();
  };

  window.closeModPanel = function() {
    document.getElementById('mod-panel').classList.remove('active');
  };

  function loadReports() {
    getReports(function(reports) {
      var container = document.getElementById('mod-reports-container');
      if (reports.length === 0) {
        container.innerHTML = '<p class="mod-empty">No reports. Everything looks clean!</p>';
        return;
      }

      var html = '';
      reports.forEach(function(report) {
        var statusClass = report.status === 'resolved' ? 'tag-resolved' : (report.status === 'dismissed' ? 'tag-dismissed' : 'tag-pending');
        var statusLabel = report.status.charAt(0).toUpperCase() + report.status.slice(1);

        html += '<div class="mod-report-card">' +
          '<div class="mod-report-header">' +
            '<span class="tag ' + statusClass + '">' + statusLabel + '</span>' +
            '<span class="mod-report-type">' + report.targetType + '</span>' +
            '<span class="mod-report-date">' + (report.createdAt ? formatDate(report.createdAt) : '') + '</span>' +
          '</div>' +
          '<div class="mod-report-body">' +
            '<p><strong>Reason:</strong> ' + escapeHtml(report.reason) + '</p>' +
            '<p><strong>Reported by:</strong> ' + escapeHtml(report.reporterName) + '</p>' +
          '</div>' +
          '<div class="mod-report-actions">' +
            '<button class="btn-mod btn-mod-resolve" onclick="resolveReport(\'' + report.id + '\', \'' + report.targetId + '\', \'' + report.targetType + '\')">Resolve & Delete</button>' +
            '<button class="btn-mod btn-mod-dismiss" onclick="dismissReport(\'' + report.id + '\')">Dismiss</button>' +
          '</div>' +
        '</div>';
      });
      container.innerHTML = html;
    });
  }

  window.resolveReport = async function(reportId, targetId, targetType) {
    if (!confirm('This will delete the reported content and mark the report as resolved. Continue?')) return;

    try {
      // Delete the reported content
      if (targetType === 'thread') {
        await deleteThread(targetId);
      } else if (targetType === 'reply') {
        // Get threadId from the reply
        var replyDoc = await db.collection("replies").doc(targetId).get();
        if (replyDoc.exists) {
          await deleteReply(targetId, replyDoc.data().threadId);
        }
      }
      await updateReport(reportId, { status: 'resolved' });
    } catch (error) {
      console.error("Resolve error:", error);
      alert('Failed to resolve report.');
    }
  };

  window.dismissReport = async function(reportId) {
    try {
      await updateReport(reportId, { status: 'dismissed' });
    } catch (error) {
      console.error("Dismiss error:", error);
      alert('Failed to dismiss report.');
    }
  };

  // ── Utility Functions ──
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(timestamp) {
    if (!timestamp) return 'Just now';
    var date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
  }

  // ── Close modals on overlay click ──
  document.addEventListener('click', function(e) {
    if (e.target.id === 'new-thread-modal') window.closeNewThreadModal();
    if (e.target.id === 'thread-detail-modal') window.closeThreadDetail();
    if (e.target.id === 'auth-modal') window.closeAuthModal();
    if (e.target.id === 'report-modal') window.closeReportModal();
    if (e.target.id === 'link-account-modal') window.closeLinkAccountModal();
    if (e.target.id === 'mod-panel') window.closeModPanel();
  });

  // ── Close modals on Escape key ──
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      window.closeNewThreadModal();
      window.closeThreadDetail();
      window.closeAuthModal();
      window.closeReportModal();
      window.closeLinkAccountModal();
      window.closeModPanel();
    }
  });

  // ── Initialize ──
  document.addEventListener('DOMContentLoaded', function() {
    loadCategories();
    loadThreads();
  });

  document.addEventListener("DOMContentLoaded", () => {
  const rulesContent = document.getElementById("rules-content");
  const checkbox = document.getElementById("rules-checkbox");
  const continueBtn = document.getElementById("rules-continue");
  const overlay = document.getElementById("rules-gate");

  // Disable page interaction until accepted
  document.body.style.overflow = "hidden";

  // Detect scroll to bottom
  rulesContent.addEventListener("scroll", () => {
    const isBottom =
      rulesContent.scrollTop + rulesContent.clientHeight >= rulesContent.scrollHeight - 5;

    if (isBottom) {
      checkbox.disabled = false;
    }
  });

  // Enable button when checked
  checkbox.addEventListener("change", () => {
    continueBtn.disabled = !checkbox.checked;
  });

  // Close modal
  continueBtn.addEventListener("click", () => {
    overlay.style.display = "none";
    document.body.style.overflow = "auto";
  });

});

})();

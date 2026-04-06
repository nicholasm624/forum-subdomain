// ── FAQ Toggler ──
function setupFaq() {
  const faqBtns = document.querySelectorAll('.faq-btn');
  faqBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const ans = this.nextElementSibling;
      const isOpen = ans.classList.contains('open');
      
      // Close all others
      document.querySelectorAll('.faq-ans.open').forEach(a => {
        a.classList.remove('open');
        a.previousElementSibling.classList.remove('open');
      });
      
      // Open clicked one if it wasn't open
      if (!isOpen) {
        ans.classList.add('open');
        this.classList.add('open');
      }
    });
  });
}

// ── IntersectionObserver removed ──

// ── Avatar Marquee Generator ──
function setupAvatars() {
  const row = document.getElementById('av-row');
  if(!row) return;

  const palettes = ['#FF5515','#7C3AED','#059669','#D97706','#DC2626','#0284C7','#DB2777','#65A30D'];
  let html = '';
  // Generate 28 avatars for the marquee
  for (let i = 0; i < 28; i++) {
    // Randomize colors a bit more naturally or keep the modulo pattern
    const bg = palettes[i % palettes.length];
    html += `<div class="av" style="background:${bg}"><div class="av-inner" style="color:${bg}"></div><div class="av-mouth"></div></div>`;
  }
  
  // Double it for seamless scrolling
  row.innerHTML = html + html;
}

// ── Secret Minigame Logic ──
function setupSecret() {
  const secretCode = 'paintball';
  let inputBuffer = '';
  
  document.addEventListener('keydown', (e) => {
    inputBuffer += e.key.toLowerCase();
    if (inputBuffer.length > secretCode.length) {
      inputBuffer = inputBuffer.slice(-secretCode.length);
    }
    if (inputBuffer === secretCode) {
      inputBuffer = '';
      startMinigame();
    }
  });

  // Create UI
  const overlay = document.createElement('div');
  overlay.id = 'minigame-overlay';
  overlay.innerHTML = `
    <div id="minigame-ui">Score: <span id="minigame-score">0</span> <br> Time: <span id="minigame-timer">15</span></div>
    <div id="minigame-end">
      <h2>Game Over!</h2>
      <p style="font-size: 20px; font-weight: 800;">Coach says: Game On!</p>
      <p style="font-size: 18px; color: var(--text-mid);">You scored <span id="final-score" style="color: var(--orange); font-size: 24px;">0</span> hits!</p>
      <button class="btn-orange" onclick="document.getElementById('minigame-overlay').classList.remove('active')">Close Game</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

function startMinigame() {
  const overlay = document.getElementById('minigame-overlay');
  const scoreEl = document.getElementById('minigame-score');
  const timerEl = document.getElementById('minigame-timer');
  const endCard = document.getElementById('minigame-end');
  
  overlay.classList.add('active');
  endCard.style.display = 'none';
  
  // Clear any existing targets in case of restart
  overlay.querySelectorAll('.target').forEach(t => t.remove());
  
  let score = 0;
  let timeLeft = 15;
  scoreEl.innerText = score;
  timerEl.innerText = timeLeft;
  
  const timerInt = setInterval(() => {
    timeLeft--;
    timerEl.innerText = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInt);
      clearInterval(spawnInt);
      overlay.querySelectorAll('.target').forEach(t => t.remove());
      endCard.style.display = 'flex';
      document.getElementById('final-score').innerText = score;
    }
  }, 1000);
  
  const spawnInt = setInterval(() => {
    const target = document.createElement('div');
    target.className = 'target';
    if (Math.random() > 0.5) target.classList.add('blue');
    
    // Random position within 10% to 90% of screen to keep it visible
    target.style.left = 10 + Math.random() * 80 + 'vw';
    target.style.top = 10 + Math.random() * 80 + 'vh';
    
    target.onclick = function(e) {
      score++;
      scoreEl.innerText = score;
      
      const splat = document.createElement('div');
      splat.className = 'splat';
      splat.style.left = e.clientX + 'px';
      splat.style.top = e.clientY + 'px';
      overlay.appendChild(splat);
      
      setTimeout(() => splat.remove(), 800);
      target.remove();
    };
    
    overlay.appendChild(target);
    // Remove if unclicked
    setTimeout(() => { if (target.parentNode) target.remove(); }, 1200);
  }, 600);
}

// ── Dodgeball Minigame Logic ──
function setupDodgeball() {
  const secretCode = 'dodgeball';
  let inputBuffer = '';
  
  document.addEventListener('keydown', (e) => {
    inputBuffer += e.key.toLowerCase();
    if (inputBuffer.length > secretCode.length) {
      inputBuffer = inputBuffer.slice(-secretCode.length);
    }
    if (inputBuffer === secretCode) {
      inputBuffer = '';
      startDodgeball();
    }
  });

  const overlay = document.createElement('div');
  overlay.id = 'dodgeball-overlay';
  overlay.innerHTML = `
    <div id="dodgeball-ui">Time: <span id="dodgeball-timer">10</span></div>
    <div id="dodgeball-end">
      <h2 id="dodgeball-title">You Survived!</h2>
      <button class="btn-orange" onclick="document.getElementById('dodgeball-overlay').classList.remove('active')">Close Game</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

function startDodgeball() {
  const overlay = document.getElementById('dodgeball-overlay');
  const timerEl = document.getElementById('dodgeball-timer');
  const endCard = document.getElementById('dodgeball-end');
  const title = document.getElementById('dodgeball-title');
  
  overlay.classList.add('active');
  endCard.style.display = 'none';
  overlay.querySelectorAll('.dodgeball').forEach(d => d.remove());
  
  let timeLeft = 10;
  timerEl.innerText = timeLeft;
  let isGameOver = false;

  const timerInt = setInterval(() => {
    if(isGameOver) { clearInterval(timerInt); return; }
    timeLeft--;
    timerEl.innerText = timeLeft;
    if (timeLeft <= 0) {
      isGameOver = true;
      clearInterval(timerInt);
      clearInterval(spawnInt);
      overlay.querySelectorAll('.dodgeball').forEach(d => d.remove());
      title.innerText = "You Survived!";
      title.style.color = "var(--orange)";
      endCard.style.display = 'flex';
    }
  }, 1000);
  
  const spawnInt = setInterval(() => {
    if (isGameOver) return;
    const ball = document.createElement('div');
    ball.className = 'dodgeball';
    
    // Spawn Left or Right
    const isLeft = Math.random() > 0.5;
    ball.style.top = Math.random() * 80 + 10 + 'vh';
    ball.style.left = isLeft ? '-100px' : '110vw';
    overlay.appendChild(ball);

    // Make it fly across using transition
    setTimeout(() => {
      ball.style.left = isLeft ? '110vw' : '-100px';
    }, 50);

    // Check hit collision via hover simulation
    ball.onmouseover = () => {
      if (!isGameOver && overlay.classList.contains('active')) {
        isGameOver = true;
        clearInterval(timerInt);
        clearInterval(spawnInt);
        overlay.querySelectorAll('.dodgeball').forEach(d => d.remove());
        title.innerText = "OUT!";
        title.style.color = "#E63946";
        endCard.style.display = 'flex';
      }
    };

    setTimeout(() => { if (ball.parentNode) ball.remove(); }, 2000);
  }, 350);
}

// Initialize everything on DOM load
document.addEventListener('DOMContentLoaded', () => {
  setupFaq();
  setupAvatars();
  setupSecret();
  setupDodgeball();
});

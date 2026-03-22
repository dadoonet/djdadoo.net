/**
 * DJ Elky — player.js
 * Uses Howler.js for audio playback.
 * Playlist data injected by Hugo into #playlist-data (JSON).
 */
(function () {
  "use strict";

  // ── Load playlist ─────────────────────────────────────────────────────────
  const playlistEl = document.getElementById("playlist-data");
  if (!playlistEl) return;

  const PLAYLIST = JSON.parse(playlistEl.textContent);
  if (!PLAYLIST.length) return;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const playerEl       = document.getElementById("player");
  const coverEl        = document.getElementById("player-cover");
  const titleEl        = document.getElementById("player-title");
  const subtitleEl     = document.getElementById("player-subtitle");
  const chaptersEl     = document.getElementById("player-chapters");
  const btnPlay        = document.getElementById("btn-play");
  const btnPrev        = document.getElementById("btn-prev");
  const btnNext        = document.getElementById("btn-next");
  const progressBar    = document.getElementById("progress-bar");
  const progressFill   = document.getElementById("progress-fill");
  const currentTimeEl  = document.getElementById("player-current");
  const durationEl     = document.getElementById("player-duration");
  const volumeSlider   = document.getElementById("volume-slider");
  const cards          = document.querySelectorAll(".mix-card");

  // ── State ──────────────────────────────────────────────────────────────────
  let currentIndex = -1;
  let sound = null;
  let rafId = null;
  let isDragging = false;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  /** Convert "HH:MM:SS" or "MM:SS" string to seconds */
  function timeToSeconds(str) {
    if (!str) return 0;
    const parts = str.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  // ── Card clicks ────────────────────────────────────────────────────────────
  cards.forEach(function (card) {
    function activate() {
      const idx = parseInt(card.dataset.index, 10);
      if (idx === currentIndex) {
        togglePlayPause();
      } else {
        loadAndPlay(idx);
      }
    }
    card.addEventListener("click", activate);
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });

  // ── Load & play ────────────────────────────────────────────────────────────
  function loadAndPlay(index) {
    if (index < 0 || index >= PLAYLIST.length) return;

    // Stop previous
    if (sound) {
      sound.stop();
      sound.unload();
    }
    cancelAnimationFrame(rafId);

    currentIndex = index;
    const mix = PLAYLIST[index];

    // Update UI
    updateActiveCard(index);
    playerEl.removeAttribute("hidden");
    titleEl.textContent   = mix.title;
    subtitleEl.textContent = mix.subtitle || "";
    coverEl.src  = mix.cover || "/djdadoo-new.jpg";
    coverEl.alt  = mix.title;
    progressFill.style.width = "0%";
    currentTimeEl.textContent = "0:00";
    durationEl.textContent = mix.duration || "0:00";
    btnPlay.textContent = "⏸";

    buildChapters(mix.chapters || []);

    // Create Howl
    sound = new Howl({
      src: [mix.audioUrl],
      html5: true,
      volume: parseFloat(volumeSlider.value),
      onplay: function () {
        btnPlay.textContent = "⏸";
        updateActiveCard(index);
        scheduleProgress();
      },
      onpause: function () {
        btnPlay.textContent = "▶";
        cancelAnimationFrame(rafId);
      },
      onstop: function () {
        btnPlay.textContent = "▶";
        cancelAnimationFrame(rafId);
      },
      onend: function () {
        cancelAnimationFrame(rafId);
        skipTo(index + 1);
      },
      onload: function () {
        const dur = sound.duration();
        if (dur) durationEl.textContent = formatTime(dur);
      },
    });

    sound.play();
  }

  function togglePlayPause() {
    if (!sound) return;
    if (sound.playing()) {
      sound.pause();
    } else {
      sound.play();
    }
  }

  function skipTo(index) {
    const i = ((index % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
    loadAndPlay(i);
  }

  // ── Progress ───────────────────────────────────────────────────────────────
  function scheduleProgress() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateProgress);
  }

  function updateProgress() {
    if (!sound || !sound.playing()) return;
    const seek = sound.seek() || 0;
    const dur  = sound.duration() || 1;
    currentTimeEl.textContent  = formatTime(seek);
    progressFill.style.width   = ((seek / dur) * 100).toFixed(2) + "%";
    highlightChapter(seek);
    rafId = requestAnimationFrame(updateProgress);
  }

  // ── Seek on progress bar ───────────────────────────────────────────────────
  function seekFromEvent(e) {
    if (!sound) return;
    const rect = progressBar.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    sound.seek(ratio * sound.duration());
    progressFill.style.width = (ratio * 100).toFixed(2) + "%";
  }

  progressBar.addEventListener("mousedown", function (e) {
    isDragging = true;
    seekFromEvent(e);
  });
  document.addEventListener("mousemove", function (e) { if (isDragging) seekFromEvent(e); });
  document.addEventListener("mouseup",   function ()  { isDragging = false; });

  // Touch support
  progressBar.addEventListener("touchstart", function (e) {
    isDragging = true;
    seekFromEvent(e.touches[0]);
  }, { passive: true });
  document.addEventListener("touchmove",  function (e) { if (isDragging) seekFromEvent(e.touches[0]); }, { passive: true });
  document.addEventListener("touchend",   function ()  { isDragging = false; });

  // ── Buttons ────────────────────────────────────────────────────────────────
  btnPlay.addEventListener("click", function () {
    if (currentIndex < 0) { loadAndPlay(0); }
    else                  { togglePlayPause(); }
  });
  btnPrev.addEventListener("click", function () { skipTo(currentIndex - 1); });
  btnNext.addEventListener("click", function () { skipTo(currentIndex + 1); });

  // ── Volume ─────────────────────────────────────────────────────────────────
  volumeSlider.addEventListener("input", function () {
    if (sound) sound.volume(parseFloat(this.value));
  });

  // ── Chapters ───────────────────────────────────────────────────────────────
  function buildChapters(chapters) {
    chaptersEl.innerHTML = "";
    if (!chapters.length) {
      chaptersEl.setAttribute("hidden", "");
      return;
    }
    chapters.forEach(function (ch, i) {
      const div = document.createElement("div");
      div.className = "chapter-item";
      div.dataset.index = i;
      div.dataset.seconds = timeToSeconds(ch.time);
      div.innerHTML =
        '<span class="chapter-time">' + ch.time + "</span>" +
        '<span class="chapter-title">' + escapeHtml(ch.title) + "</span>";
      div.addEventListener("click", function () {
        if (sound) sound.seek(parseFloat(div.dataset.seconds));
      });
      chaptersEl.appendChild(div);
    });
    chaptersEl.removeAttribute("hidden");
  }

  function highlightChapter(currentSec) {
    const items = chaptersEl.querySelectorAll(".chapter-item");
    let active = null;
    items.forEach(function (item) {
      const sec = parseFloat(item.dataset.seconds);
      if (sec <= currentSec) active = item;
    });
    items.forEach(function (item) { item.classList.remove("active"); });
    if (active) active.classList.add("active");
  }

  // ── Active card ────────────────────────────────────────────────────────────
  function updateActiveCard(index) {
    cards.forEach(function (c) { c.classList.remove("active"); });
    if (cards[index]) cards[index].classList.add("active");
  }

  // ── Escape HTML ────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

})();

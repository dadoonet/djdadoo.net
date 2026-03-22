/**
 * DJ Elky — player.js
 * Requires Howler.js (loaded before this script).
 * Playlist data injected by Hugo into #playlist-data (JSON).
 */
(function () {
  "use strict";

  // ── Load playlist ─────────────────────────────────────────────────────────
  var PLAYLIST = window.__djPlaylist;
  if (!PLAYLIST || !PLAYLIST.length) return;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  var playerEl      = document.getElementById("player");
  var coverEl       = document.getElementById("player-cover");
  var titleEl       = document.getElementById("player-title");
  var subtitleEl    = document.getElementById("player-subtitle");
  var chaptersEl        = document.getElementById("player-chapters");
  var chapterCurrentEl  = document.getElementById("player-chapter-current");
  var btnPlay       = document.getElementById("btn-play");
  var btnPrev       = document.getElementById("btn-prev");
  var btnNext       = document.getElementById("btn-next");
  var progressBar   = document.getElementById("progress-bar");
  var progressFill  = document.getElementById("progress-fill");
  var currentTimeEl = document.getElementById("player-current");
  var durationEl    = document.getElementById("player-duration");
  var volumeSlider  = document.getElementById("volume-slider");
  var cards         = document.querySelectorAll(".mix-card");

  // ── State ──────────────────────────────────────────────────────────────────
  var currentIndex = -1;
  var sound        = null;
  var rafId        = null;
  var isDragging   = false;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function formatTime(secs) {
    if (!secs || isNaN(secs) || secs < 0) return "0:00";
    var h = Math.floor(secs / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = Math.floor(secs % 60);
    if (h > 0) return h + ":" + pad(m) + ":" + pad(s);
    return m + ":" + pad(s);
  }
  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function timeToSeconds(str) {
    if (!str) return 0;
    var parts = str.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Card clicks ────────────────────────────────────────────────────────────
  cards.forEach(function (card) {
    function onActivate() {
      var idx = parseInt(card.dataset.index, 10);
      if (idx === currentIndex) {
        togglePlayPause();
      } else {
        loadAndPlay(idx);
      }
    }
    card.addEventListener("click", onActivate);
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    });
  });

  // ── Load & play ────────────────────────────────────────────────────────────
  function loadAndPlay(index) {
    if (index < 0 || index >= PLAYLIST.length) return;

    // Unload previous sound
    if (sound) {
      sound.unload();
      sound = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    currentIndex = index;
    var mix = PLAYLIST[index];

    // Show player bar
    playerEl.removeAttribute("hidden");

    // Update display
    titleEl.textContent    = mix.title  || "";
    subtitleEl.textContent = mix.subtitle || "";
    coverEl.src            = mix.cover  || "/djdadoo-new.jpg";
    coverEl.alt            = mix.title  || "";
    progressFill.style.width  = "0%";
    currentTimeEl.textContent = "0:00";
    durationEl.textContent    = mix.duration || "…";
    setPlayBtn(true);  // show pause icon immediately (optimistic)

    updateActiveCard(index, true);
    buildChapters(mix.chapters || []);
    highlightChapter(0);

    // Create Howl
    sound = new Howl({
      src:   [mix.audioUrl],
      html5: true,
      volume: parseFloat(volumeSlider.value) || 1,

      onplay: function () {
        setPlayBtn(true);
        updateActiveCard(currentIndex, true);
        scheduleProgress();
      },
      onpause: function () {
        setPlayBtn(false);
        updateActiveCard(currentIndex, false);
        cancelAnimationFrame(rafId);
      },
      onstop: function () {
        setPlayBtn(false);
        updateActiveCard(currentIndex, false);
        cancelAnimationFrame(rafId);
      },
      onend: function () {
        cancelAnimationFrame(rafId);
        progressFill.style.width = "100%";
        skipTo(currentIndex + 1);
      },
      onload: function () {
        var dur = sound.duration();
        if (dur) durationEl.textContent = formatTime(dur);
      },
      onloaderror: function (id, err) {
        console.error("DJ Elky: load error", err);
        setPlayBtn(false);
      },
    });

    sound.play();
  }

  function setPlayBtn(playing) {
    btnPlay.textContent = playing ? "⏸" : "▶";
    btnPlay.setAttribute("aria-label", playing ? "Pause" : "Lecture");
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
    var i = ((index % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
    loadAndPlay(i);
  }

  // ── Progress loop ──────────────────────────────────────────────────────────
  function scheduleProgress() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(progressTick);
  }

  function progressTick() {
    if (!sound || !sound.playing()) return;
    var seek = sound.seek() || 0;
    var dur  = sound.duration() || 0;
    currentTimeEl.textContent = formatTime(seek);
    if (dur > 0 && !isDragging) {
      progressFill.style.width = ((seek / dur) * 100).toFixed(2) + "%";
    }
    highlightChapter(seek);
    rafId = requestAnimationFrame(progressTick);
  }

  // ── Seek ───────────────────────────────────────────────────────────────────
  function seekFromPointer(clientX) {
    if (!sound) return;
    var rect  = progressBar.getBoundingClientRect();
    var ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    var dur   = sound.duration() || 0;
    if (dur > 0) {
      sound.seek(ratio * dur);
      progressFill.style.width = (ratio * 100).toFixed(2) + "%";
      currentTimeEl.textContent = formatTime(ratio * dur);
    }
  }

  progressBar.addEventListener("mousedown", function (e) {
    isDragging = true;
    seekFromPointer(e.clientX);
  });
  document.addEventListener("mousemove", function (e) {
    if (isDragging) seekFromPointer(e.clientX);
  });
  document.addEventListener("mouseup", function () { isDragging = false; });

  progressBar.addEventListener("touchstart", function (e) {
    isDragging = true;
    seekFromPointer(e.touches[0].clientX);
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (isDragging) seekFromPointer(e.touches[0].clientX);
  }, { passive: true });
  document.addEventListener("touchend", function () { isDragging = false; });

  // ── Buttons ────────────────────────────────────────────────────────────────
  btnPlay.addEventListener("click", function () {
    if (currentIndex < 0) {
      loadAndPlay(0);
    } else {
      togglePlayPause();
    }
  });
  btnPrev.addEventListener("click", function () {
    var chapters = currentIndex >= 0 ? (PLAYLIST[currentIndex].chapters || []) : [];
    if (chapters.length && sound) {
      var seek = sound.seek() || 0;
      var activeIdx = -1;
      for (var i = chapters.length - 1; i >= 0; i--) {
        if (timeToSeconds(chapters[i].time) <= seek) { activeIdx = i; break; }
      }
      if (activeIdx > 0) {
        sound.seek(timeToSeconds(chapters[activeIdx - 1].time));
        if (!sound.playing()) sound.play();
        return;
      }
    }
    skipTo(currentIndex - 1);
  });

  btnNext.addEventListener("click", function () {
    var chapters = currentIndex >= 0 ? (PLAYLIST[currentIndex].chapters || []) : [];
    if (chapters.length && sound) {
      var seek = sound.seek() || 0;
      var activeIdx = -1;
      for (var i = chapters.length - 1; i >= 0; i--) {
        if (timeToSeconds(chapters[i].time) <= seek) { activeIdx = i; break; }
      }
      if (activeIdx < chapters.length - 1) {
        sound.seek(timeToSeconds(chapters[activeIdx + 1].time));
        if (!sound.playing()) sound.play();
        return;
      }
    }
    skipTo(currentIndex + 1);
  });

  // ── Volume ─────────────────────────────────────────────────────────────────
  volumeSlider.addEventListener("input", function () {
    if (sound) sound.volume(parseFloat(this.value));
  });

  // ── Chapters ───────────────────────────────────────────────────────────────
  function buildChapters(chapters) {
    chaptersEl.innerHTML = "";
    chaptersEl.setAttribute("hidden", "");
    chapterCurrentEl.setAttribute("hidden", "");
    chapterCurrentEl.setAttribute("aria-expanded", "false");
    if (!chapters.length) return;

    chapters.forEach(function (ch, i) {
      var div = document.createElement("div");
      div.className        = "chapter-item";
      div.dataset.index    = i;
      div.dataset.seconds  = timeToSeconds(ch.time);
      div.innerHTML =
        '<span class="chapter-time">' + escapeHtml(ch.time) + "</span>" +
        '<span class="chapter-title">' + escapeHtml(ch.title) + "</span>";
      div.addEventListener("click", function (e) {
        e.stopPropagation();
        if (sound) {
          sound.seek(parseFloat(div.dataset.seconds));
          if (!sound.playing()) sound.play();
        }
      });
      chaptersEl.appendChild(div);
    });
    chapterCurrentEl.removeAttribute("hidden");
  }

  function highlightChapter(currentSec) {
    var items  = chaptersEl.querySelectorAll(".chapter-item");
    var active = null;
    items.forEach(function (item) {
      if (parseFloat(item.dataset.seconds) <= currentSec) active = item;
    });
    items.forEach(function (item) { item.classList.remove("active"); });
    if (active) {
      active.classList.add("active");
      var titleSpan = active.querySelector(".chapter-title");
      if (titleSpan) chapterCurrentEl.textContent = titleSpan.textContent;
    }
  }

  // Toggle chapter list on click, close on outside click
  chapterCurrentEl.addEventListener("click", function () {
    if (chaptersEl.hasAttribute("hidden")) {
      chaptersEl.removeAttribute("hidden");
      chapterCurrentEl.setAttribute("aria-expanded", "true");
      var activeItem = chaptersEl.querySelector(".chapter-item.active");
      if (activeItem) activeItem.scrollIntoView({ block: "nearest" });
    } else {
      chaptersEl.setAttribute("hidden", "");
      chapterCurrentEl.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("click", function (e) {
    if (!chaptersEl.hasAttribute("hidden") &&
        !chaptersEl.contains(e.target) &&
        e.target !== chapterCurrentEl) {
      chaptersEl.setAttribute("hidden", "");
      chapterCurrentEl.setAttribute("aria-expanded", "false");
    }
  });

  // ── Active card state ──────────────────────────────────────────────────────
  function updateActiveCard(index, playing) {
    cards.forEach(function (c) {
      c.classList.remove("active", "playing");
    });
    if (cards[index]) {
      cards[index].classList.add("active");
      if (playing) cards[index].classList.add("playing");
      // Update play icon
      var icon = cards[index].querySelector(".play-icon");
      if (icon) icon.textContent = playing ? "⏸" : "▶";
    }
  }

})();

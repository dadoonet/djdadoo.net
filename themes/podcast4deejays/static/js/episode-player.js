/**
 * Podcast4Deejays — episode-player.js
 * Single episode player for detail pages.
 * Requires Howler.js (loaded before this script).
 */
(function() {
  "use strict";

  // ── DOM refs ───────────────────────────────────────────────────────────────
  var coverPlayBtn     = document.querySelector(".episode-cover-play");
  var playerEl         = document.getElementById("episode-player");
  var playerCoverEl    = document.getElementById("episode-player-cover");
  var playerTitleEl    = document.getElementById("episode-player-title");
  var playerSubtitleEl = document.getElementById("episode-player-subtitle");
  var btnPlay          = document.getElementById("episode-player-btn-play");
  var btnSkipBack      = document.getElementById("episode-player-btn-skip-back");
  var btnSkipForward   = document.getElementById("episode-player-btn-skip-forward");
  var progressBar      = document.getElementById("episode-player-progress-bar");
  var progressFill     = document.getElementById("episode-player-progress-fill");
  var currentTimeEl    = document.getElementById("episode-player-current");
  var durationEl       = document.getElementById("episode-player-duration");
  var volumeSlider     = document.getElementById("episode-player-volume-slider");

  if (!coverPlayBtn) return;

  var audioURL = coverPlayBtn.getAttribute("data-audio-url");
  if (!audioURL) return;

  // ── State ──────────────────────────────────────────────────────────────────
  var sound = null;
  var isDragging = false;
  var rafId = null;

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

  // ── Load ───────────────────────────────────────────────────────────────────
  function loadAndPlay() {
    if (sound) {
      sound.unload();
      sound = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // Show player bar
    playerEl.removeAttribute("hidden");

    // Update display from page data
    var titleEl = document.querySelector(".episode-title");
    var subtitleEl = document.querySelector(".episode-subtitle");
    var coverEl = document.querySelector(".episode-cover");

    playerTitleEl.textContent = titleEl ? titleEl.textContent : "";
    playerSubtitleEl.textContent = subtitleEl ? subtitleEl.textContent : "";
    playerCoverEl.src = coverEl ? coverEl.src : "";
    playerCoverEl.alt = titleEl ? titleEl.textContent : "";

    progressFill.style.width = "0%";
    currentTimeEl.textContent = "0:00";
    durationEl.textContent = "…";
    setPlayBtn(true);

    // Create Howl
    sound = new Howl({
      src: [audioURL],
      html5: true,
      volume: parseFloat(volumeSlider.value) || 1,

      onplay: function() {
        setPlayBtn(true);
        scheduleProgress();
      },
      onpause: function() {
        setPlayBtn(false);
        cancelAnimationFrame(rafId);
      },
      onstop: function() {
        setPlayBtn(false);
        cancelAnimationFrame(rafId);
      },
      onend: function() {
        cancelAnimationFrame(rafId);
        progressFill.style.width = "100%";
        setPlayBtn(false);
      },
      onload: function() {
        var dur = sound.duration();
        if (dur) durationEl.textContent = formatTime(dur);
      },
      onloaderror: function(id, err) {
        console.error("Episode player: load error", err);
        setPlayBtn(false);
      }
    });

    sound.play();
  }

  function setPlayBtn(playing) {
    var icon = btnPlay.querySelector("i");
    if (icon) {
      icon.className = playing ? "fa-solid fa-pause" : "fa-solid fa-play";
    }
    if (coverPlayBtn) {
      var coverIcon = coverPlayBtn.querySelector("i");
      if (coverIcon) {
        coverIcon.className = playing ? "fa-solid fa-pause" : "fa-solid fa-play";
      }
    }
    btnPlay.setAttribute("aria-label", playing ? "Pause" : "Lecture");
  }

  function togglePlayPause() {
    if (!sound) {
      loadAndPlay();
    } else {
      if (sound.playing()) {
        sound.pause();
      } else {
        sound.play();
      }
    }
  }

  // ── Progress loop ──────────────────────────────────────────────────────────
  function scheduleProgress() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(progressTick);
  }

  function progressTick() {
    if (!sound || !sound.playing()) return;
    var seek = sound.seek() || 0;
    var dur = sound.duration() || 0;
    currentTimeEl.textContent = formatTime(seek);
    if (dur > 0 && !isDragging) {
      progressFill.style.width = ((seek / dur) * 100).toFixed(2) + "%";
    }
    rafId = requestAnimationFrame(progressTick);
  }

  // ── Seek ───────────────────────────────────────────────────────────────────
  function seekFromPointer(clientX) {
    if (!sound) return;
    var rect = progressBar.getBoundingClientRect();
    var ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    var dur = sound.duration() || 0;
    if (dur > 0) {
      sound.seek(ratio * dur);
      progressFill.style.width = (ratio * 100).toFixed(2) + "%";
      currentTimeEl.textContent = formatTime(ratio * dur);
    }
  }

  function skipSeconds(seconds) {
    if (!sound) return;
    var current = sound.seek() || 0;
    var dur = sound.duration() || 0;
    var newPos = Math.max(0, Math.min(current + seconds, dur));
    sound.seek(newPos);
    progressFill.style.width = (dur > 0 ? (newPos / dur * 100) : 0).toFixed(2) + "%";
    currentTimeEl.textContent = formatTime(newPos);
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  coverPlayBtn.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    togglePlayPause();
  });

  btnPlay.addEventListener("click", function() {
    togglePlayPause();
  });

  btnSkipBack.addEventListener("click", function() {
    skipSeconds(-15);
  });

  btnSkipForward.addEventListener("click", function() {
    skipSeconds(15);
  });

  // Progress bar seek
  progressBar.addEventListener("mousedown", function(e) {
    isDragging = true;
    seekFromPointer(e.clientX);
  });
  document.addEventListener("mousemove", function(e) {
    if (isDragging) seekFromPointer(e.clientX);
  });
  document.addEventListener("mouseup", function() {
    isDragging = false;
  });

  progressBar.addEventListener("touchstart", function(e) {
    isDragging = true;
    seekFromPointer(e.touches[0].clientX);
  }, { passive: true });
  document.addEventListener("touchmove", function(e) {
    if (isDragging) seekFromPointer(e.touches[0].clientX);
  }, { passive: true });
  document.addEventListener("touchend", function() {
    isDragging = false;
  });

  // Volume
  volumeSlider.addEventListener("input", function() {
    if (sound) sound.volume(parseFloat(this.value));
  });
})();

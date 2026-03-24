/**
 * Podcast4Deejays — episode-player.js
 * Single episode player for detail pages.
 * Requires Howler.js (loaded before this script).
 */

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlayer);
} else {
  initPlayer();
}

function initPlayer() {
(function() {
  "use strict";

  // ── DOM refs ───────────────────────────────────────────────────────────────
  var coverPlayBtn     = document.querySelector(".episode-cover-play");
  var playerEl         = document.getElementById("episode-player");
  var playerCoverEl    = document.getElementById("episode-player-cover");
  var playerTitleEl    = document.getElementById("episode-player-title");
  var playerSubtitleEl = document.getElementById("episode-player-subtitle");
  var chaptersEl          = document.getElementById("episode-player-chapters");
  var chapterCurrentEl    = document.getElementById("episode-player-chapter-current");
  var btnChapterPrev      = document.getElementById("episode-player-btn-chapter-prev");
  var btnChapterNext      = document.getElementById("episode-player-btn-chapter-next");
  var btnPlay             = document.getElementById("episode-player-btn-play");
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

  // ── Chapters data ──────────────────────────────────────────────────────────
  var CHAPTERS = window.__djEpisodeChapters || [];
  var currentChapIdx = -1;

  // ── State ──────────────────────────────────────────────────────────────────
  var sound = null;
  var isDragging = false;
  var rafId = null;
  var pendingChapterIdx = -1;

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

    buildChapters(CHAPTERS);
    highlightChapter(0);

    // Create Howl
    sound = new Howl({
      src: [audioURL],
      html5: true,
      volume: parseFloat(volumeSlider.value) || 1,

      onplay: function() {
        setPlayBtn(true);
        if (pendingChapterIdx >= 0) {
          var idx = pendingChapterIdx;
          pendingChapterIdx = -1;
          seekToChapter(idx);
        }
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
    highlightChapter(seek);
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

  // ── Chapter functions ──────────────────────────────────────────────────────
  function buildChapters(chapters) {
    if (!chaptersEl || !chapterCurrentEl) return;
    chaptersEl.innerHTML = "";
    chaptersEl.setAttribute("hidden", "");
    chapterCurrentEl.setAttribute("hidden", "");
    chapterCurrentEl.setAttribute("aria-expanded", "false");
    if (!chapters.length) return;

    chapters.forEach(function(ch, i) {
      var div = document.createElement("div");
      div.className = "chapter-item";
      div.dataset.index = i;
      div.dataset.seconds = timeToSeconds(ch.time);
      div.innerHTML =
        '<span class="chapter-time">' + escapeHtml(ch.time) + "</span>" +
        '<span class="chapter-title">' + escapeHtml(ch.title) + "</span>";
      div.addEventListener("click", function(e) {
        e.stopPropagation();
        if (!sound) {
          pendingChapterIdx = i;
          loadAndPlay();
        } else {
          seekToChapter(i);
        }
      });
      chaptersEl.appendChild(div);
    });
    chapterCurrentEl.removeAttribute("hidden");
    updateChapterNavButtons();
  }

  function updateChapterNavButtons() {
    if (!btnChapterPrev || !btnChapterNext) return;
    if (!CHAPTERS.length) {
      btnChapterPrev.setAttribute("hidden", "");
      btnChapterNext.setAttribute("hidden", "");
      return;
    }
    btnChapterPrev.removeAttribute("hidden");
    btnChapterNext.removeAttribute("hidden");
    btnChapterPrev.disabled = currentChapIdx <= 0;
    btnChapterNext.disabled = currentChapIdx >= CHAPTERS.length - 1;
  }

  function highlightChapter(currentSec) {
    if (!chaptersEl || !chapterCurrentEl) return;
    var items = chaptersEl.querySelectorAll(".chapter-item");
    var active = null;
    items.forEach(function(item) {
      if (parseFloat(item.dataset.seconds) <= currentSec) active = item;
    });

    if (active && currentChapIdx >= 0 && CHAPTERS[currentChapIdx]) {
      var activeIdx = parseInt(active.dataset.index, 10);
      var curStart = timeToSeconds(CHAPTERS[currentChapIdx].time);
      if (activeIdx < currentChapIdx && currentSec >= curStart - 2) return;
    }

    items.forEach(function(item) { item.classList.remove("active"); });
    if (active) {
      active.classList.add("active");
      var idx = parseInt(active.dataset.index, 10);
      if (idx !== currentChapIdx) {
        currentChapIdx = idx;
        var titleSpan = active.querySelector(".chapter-title");
        if (titleSpan) chapterCurrentEl.textContent = titleSpan.textContent;
        updateChapterNavButtons();
      }
    }
  }

  function seekToChapter(chapIdx) {
    if (!CHAPTERS[chapIdx]) return;
    currentChapIdx = chapIdx;
    var items = chaptersEl.querySelectorAll(".chapter-item");
    items.forEach(function(el) { el.classList.remove("active"); });
    var item = items[chapIdx];
    if (item) {
      item.classList.add("active");
      var sp = item.querySelector(".chapter-title");
      if (sp) chapterCurrentEl.textContent = sp.textContent;
    }
    sound.seek(timeToSeconds(CHAPTERS[chapIdx].time));
    if (!sound.playing()) sound.play();
    updateChapterNavButtons();
  }

  // Chapter prev/next buttons
  if (btnChapterPrev) {
    btnChapterPrev.addEventListener("click", function() {
      if (currentChapIdx > 0) seekToChapter(currentChapIdx - 1);
    });
  }
  if (btnChapterNext) {
    btnChapterNext.addEventListener("click", function() {
      if (currentChapIdx < CHAPTERS.length - 1) seekToChapter(currentChapIdx + 1);
    });
  }

  // Toggle chapter list on click
  if (chapterCurrentEl) {
    chapterCurrentEl.addEventListener("click", function() {
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

    document.addEventListener("click", function(e) {
      if (chaptersEl && !chaptersEl.hasAttribute("hidden") &&
          !chaptersEl.contains(e.target) &&
          e.target !== chapterCurrentEl) {
        chaptersEl.setAttribute("hidden", "");
        chapterCurrentEl.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Attach chapter list listeners (static episode chapters in content)
  var chapterItems = document.querySelectorAll('.episode-chapters-list li');
  if (chapterItems.length > 0) {
    chapterItems.forEach(function(item) {
      item.addEventListener('click', function() {
        var index = parseInt(item.dataset.chapterIndex, 10);
        if (index >= 0 && CHAPTERS[index]) {
          if (!sound) {
            pendingChapterIdx = index;
            loadAndPlay();
          } else {
            seekToChapter(index);
          }
        }
      });
    });
  }

})();
} // Close initPlayer function

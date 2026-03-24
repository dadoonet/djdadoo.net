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
  var btnSkipBack   = document.getElementById("btn-skip-back");
  var btnSkipForward= document.getElementById("btn-skip-forward");
  var progressBar   = document.getElementById("progress-bar");
  var progressFill  = document.getElementById("progress-fill");
  var currentTimeEl = document.getElementById("player-current");
  var durationEl    = document.getElementById("player-duration");
  var volumeSlider  = document.getElementById("volume-slider");
  var cards         = document.querySelectorAll(".mix-card");

  // ── State ──────────────────────────────────────────────────────────────────
  var currentIndex    = -1;
  var currentChapIdx  = -1;   // index of the highlighted chapter
  var sound           = null;
  var rafId           = null;
  var isDragging      = false;
  var modalEpisodeData = null;  // Store data of episode currently shown in modal

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

    currentIndex   = index;
    currentChapIdx = -1;
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
    var icon = btnPlay.querySelector("i");
    if (icon) {
      icon.className = playing ? "fa-solid fa-pause" : "fa-solid fa-play";
    }
    btnPlay.setAttribute("aria-label", playing ? "Pause" : "Lecture");
  }

  function setModalPlayBtn(playing) {
    var playBtn = modalEl.querySelector(".mix-modal-cover-play");
    if (playBtn) {
      var icon = playBtn.querySelector("i");
      if (!icon) {
        icon = document.createElement("i");
        playBtn.innerHTML = "";
        playBtn.appendChild(icon);
      }
      icon.className = playing ? "fa-solid fa-pause" : "fa-solid fa-play";
      playBtn.setAttribute("aria-label", playing ? "Pause" : "Lire cet épisode");
    }
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

  function skipSeconds(seconds) {
    if (!sound) return;
    var current = sound.seek() || 0;
    var dur = sound.duration() || 0;
    var newPos = Math.max(0, Math.min(current + seconds, dur));
    sound.seek(newPos);
    progressFill.style.width = (dur > 0 ? (newPos / dur * 100) : 0).toFixed(2) + "%";
    currentTimeEl.textContent = formatTime(newPos);
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
    if (chapters.length && sound && currentChapIdx > 0) {
      seekToChapter(currentChapIdx - 1);
      return;
    }
    skipTo(currentIndex - 1);
  });

  btnNext.addEventListener("click", function () {
    var chapters = currentIndex >= 0 ? (PLAYLIST[currentIndex].chapters || []) : [];
    if (chapters.length && sound && currentChapIdx < chapters.length - 1) {
      seekToChapter(currentChapIdx + 1);
      return;
    }
    skipTo(currentIndex + 1);
  });

  btnSkipBack.addEventListener("click", function () {
    skipSeconds(-15);
  });

  btnSkipForward.addEventListener("click", function () {
    skipSeconds(15);
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
        if (sound) seekToChapter(i);
      });
      chaptersEl.appendChild(div);
    });
    chapterCurrentEl.removeAttribute("hidden");
  }

  function highlightChapter(currentSec) {
    var chapters = currentIndex >= 0 ? (PLAYLIST[currentIndex].chapters || []) : [];
    var items    = chaptersEl.querySelectorAll(".chapter-item");
    var active   = null;
    items.forEach(function (item) {
      if (parseFloat(item.dataset.seconds) <= currentSec) active = item;
    });

    // Guard: if the computed chapter would go backward and the audio position
    // is within 2s of the current chapter's start, it's MP3 seek drift — keep
    // the chapter we already set (e.g. from seekToChapter).
    if (active && currentChapIdx >= 0 && chapters[currentChapIdx]) {
      var activeIdx = parseInt(active.dataset.index, 10);
      var curStart  = timeToSeconds(chapters[currentChapIdx].time);
      if (activeIdx < currentChapIdx && currentSec >= curStart - 2) {
        return;
      }
    }

    items.forEach(function (item) { item.classList.remove("active"); });
    if (active) {
      active.classList.add("active");
      var idx = parseInt(active.dataset.index, 10);
      if (idx !== currentChapIdx) {
        currentChapIdx = idx;
        var titleSpan = active.querySelector(".chapter-title");
        if (titleSpan) chapterCurrentEl.textContent = titleSpan.textContent;
      }
    }
  }

  function seekToChapter(chapIdx) {
    var chapters = currentIndex >= 0 ? (PLAYLIST[currentIndex].chapters || []) : [];
    if (!chapters[chapIdx]) return;
    currentChapIdx = chapIdx;
    var titleEl2 = chaptersEl.querySelectorAll(".chapter-item")[chapIdx];
    if (titleEl2) {
      chaptersEl.querySelectorAll(".chapter-item").forEach(function (el) { el.classList.remove("active"); });
      titleEl2.classList.add("active");
      var sp = titleEl2.querySelector(".chapter-title");
      if (sp) chapterCurrentEl.textContent = sp.textContent;
    }
    sound.seek(timeToSeconds(chapters[chapIdx].time));
    if (!sound.playing()) sound.play();
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
      if (icon) {
        var i = icon.querySelector("i");
        if (i) {
          i.className = playing ? "fa-solid fa-pause" : "fa-solid fa-play";
        }
      }
    }

    // Update modal play button if it's open and showing this episode
    if (!modalEl.hasAttribute("hidden") && modalEpisodeData) {
      var cd = cards[index] ? cards[index].querySelector(".mix-data") : null;
      if (cd && cd.dataset.season === modalEpisodeData.season &&
          cd.dataset.episode === modalEpisodeData.episode) {
        setModalPlayBtn(playing);
      }
    }
  }


  // ── Info modal ─────────────────────────────────────────────────────────────
  var modalEl       = document.getElementById("mix-modal");
  var modalClose    = modalEl.querySelector(".mix-modal-close");
  var modalBackdrop = modalEl.querySelector(".mix-modal-backdrop");

  function getRelatedMixes(event) {
    if (!event) return [];
    var related = [];
    var allDataElements = document.querySelectorAll(".mix-data");
    allDataElements.forEach(function(el) {
      if (el.dataset.event && el.dataset.event === event) {
        related.push(el);
      }
    });
    // Sort by episode number (ascending - oldest first)
    related.sort(function(a, b) {
      var episodeA = parseInt(a.dataset.episode, 10) || 0;
      var episodeB = parseInt(b.dataset.episode, 10) || 0;
      return episodeA - episodeB;
    });
    return related;
  }

  function openModal(card) {
    var d = card.querySelector(".mix-data");
    if (!d) return;

    // Store modal episode data for updateActiveCard
    modalEpisodeData = {
      season: d.dataset.season,
      episode: d.dataset.episode
    };

    modalEl.querySelector(".mix-modal-cover").src            = d.dataset.cover || "";
    modalEl.querySelector(".mix-modal-cover").alt            = d.dataset.title || "";
    modalEl.querySelector(".mix-modal-title").textContent    = d.dataset.title || "";
    modalEl.querySelector(".mix-modal-episode").textContent  =
      "Ép. " + (d.dataset.episode || "?") + " · " + (d.dataset.season || "");
    modalEl.querySelector(".mix-modal-duration").textContent = d.dataset.duration || "";

    // Set subtitle and show/hide based on content
    var subtitleEl = modalEl.querySelector(".mix-modal-subtitle");
    if (d.dataset.subtitle) {
      subtitleEl.textContent = d.dataset.subtitle;
      subtitleEl.removeAttribute("hidden");
    } else {
      subtitleEl.setAttribute("hidden", "");
    }

    // Render keywords as badges
    var keywordsEl = modalEl.querySelector(".mix-modal-keywords");
    keywordsEl.innerHTML = "";
    if (d.dataset.keywords) {
      var keywords = d.dataset.keywords.split(",").map(function(k) { return k.trim(); }).filter(function(k) { return k; });
      var keywordHTML = keywords.map(function(keyword) {
        return '<span class="keyword-badge">' + escapeHtml(keyword) + '</span>';
      }).join("");
      keywordsEl.innerHTML = keywordHTML;
    }

    // Handle multiple authors
    var authorsListEl = modalEl.querySelector(".mix-modal-authors-list");
    authorsListEl.innerHTML = "";
    var authorsJSON = [];
    try {
      authorsJSON = JSON.parse(d.dataset.authors || "[]");
    } catch (e) {
      console.error("Failed to parse authors JSON", e);
    }

    authorsJSON.forEach(function(author) {
      var authorEl = document.createElement("div");
      authorEl.className = "mix-modal-author";

      var imgEl = document.createElement("img");
      imgEl.className = "mix-modal-author-cover";
      imgEl.src = author.cover || "/img/authors/undefined.png";
      imgEl.alt = author.name || "";
      imgEl.onerror = function() {
        this.src = "/img/authors/undefined.png";
      };

      var nameEl = document.createElement("p");
      nameEl.className = "mix-modal-author-name";
      nameEl.textContent = author.name || "";

      authorEl.appendChild(imgEl);
      authorEl.appendChild(nameEl);
      authorsListEl.appendChild(authorEl);
    });

    modalEl.querySelector(".mix-modal-body").innerHTML       = d.innerHTML;

    // Handle related mixes
    var event = d.dataset.event;
    var sidebarEl = modalEl.querySelector(".mix-modal-sidebar");
    var relatedEl = modalEl.querySelector(".mix-modal-related");

    if (event) {
      var relatedMixes = getRelatedMixes(event);
      if (relatedMixes.length > 1) {
        // Show sidebar
        sidebarEl.removeAttribute("hidden");
        relatedEl.innerHTML = "";

        relatedMixes.forEach(function(relatedData) {
          var relatedTitle = relatedData.dataset.title || "";
          var relatedSubtitle = relatedData.dataset.subtitle || "";
          var relatedEpisode = relatedData.dataset.episode || "?";
          var relatedSeason = relatedData.dataset.season || "";
          var isActive = relatedData.dataset.season === d.dataset.season &&
                         relatedData.dataset.episode === d.dataset.episode;

          var relatedLink = document.createElement("div");
          relatedLink.className = "mix-modal-related-item" + (isActive ? " active" : "");
          var html = '<strong>' + escapeHtml(relatedTitle) + '</strong>';
          if (relatedSubtitle) {
            html += '<br><small>' + escapeHtml(relatedSubtitle) + '</small>';
          }
          html += '<br><small>Ép. ' + escapeHtml(relatedEpisode) + '</small>';
          relatedLink.innerHTML = html;

          // Find corresponding card by season + episode
          var cardIndex = Array.from(cards).findIndex(function(c) {
            var cd = c.querySelector(".mix-data");
            return cd && cd.dataset.season === relatedData.dataset.season &&
                         cd.dataset.episode === relatedData.dataset.episode;
          });

          if (cardIndex >= 0) {
            relatedLink.style.cursor = "pointer";
            relatedLink.addEventListener("click", function() {
              // Remove playing state from old episode
              if (currentIndex >= 0 && cards[currentIndex]) {
                cards[currentIndex].classList.remove("active", "playing");
                var icon = cards[currentIndex].querySelector(".play-icon");
                if (icon) icon.textContent = "▶";
              }
              closeModal();
              openModal(cards[cardIndex]);
            });
          }
          relatedEl.appendChild(relatedLink);
        });
      } else {
        sidebarEl.setAttribute("hidden", "");
      }
    } else {
      sidebarEl.setAttribute("hidden", "");
    }

    modalEl.removeAttribute("hidden");
    document.body.style.overflow = "hidden";

    // Update modal play button icon based on current playback state
    var cardIndex = Array.from(cards).findIndex(function(c) {
      var cd = c.querySelector(".mix-data");
      return cd && cd.dataset.season === d.dataset.season &&
                   cd.dataset.episode === d.dataset.episode;
    });
    var isPlaying = cardIndex === currentIndex && sound && sound.playing();
    setModalPlayBtn(isPlaying);

    // Add play button handler
    var playBtn = modalEl.querySelector(".mix-modal-cover-play");
    playBtn.onclick = function() {
      if (cardIndex >= 0) {
        if (cardIndex === currentIndex && sound && sound.playing()) {
          sound.pause();
        } else {
          loadAndPlay(cardIndex);
        }
      }
    };
  }

  function closeModal() {
    modalEl.setAttribute("hidden", "");
    document.body.style.overflow = "";
    modalEpisodeData = null;
  }

  document.querySelectorAll(".mix-card-info-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      openModal(btn.closest(".mix-card"));
    });
  });
  modalClose.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modalEl.hasAttribute("hidden")) closeModal();
  });

})();

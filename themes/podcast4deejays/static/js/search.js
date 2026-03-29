(function () {
  "use strict";

  var inputEl = document.getElementById("site-search-input");
  var resultsEl = document.getElementById("site-search-results");

  if (!inputEl || !resultsEl) {
    return;
  }

  var pagefindModule = null;
  var searchToken = 0;
  var debounceTimer = null;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showResults() {
    resultsEl.hidden = false;
  }

  function normalizeImageUrl(url) {
    if (!url) {
      return "";
    }

    if (/^(https?:)?\/\//.test(url) || url[0] === "/") {
      return url;
    }

    return "/" + url;
  }

  function hideResults() {
    resultsEl.hidden = true;
  }

  function renderMessage(message) {
    resultsEl.innerHTML = '<div class="header-search-empty">' + escapeHtml(message) + "</div>";
    showResults();
  }

  function renderHits(hits) {
    if (!hits.length) {
      renderMessage("Aucun resultat");
      return;
    }

    var html = hits
      .map(function (hit) {
        var meta = hit.meta || {};
        var coverUrl = normalizeImageUrl(meta.image || meta.cover || meta["image[src]"] || meta["cover[src]"]);
        var cover = coverUrl
          ? '<img class="header-search-cover" src="' + escapeHtml(coverUrl) + '" alt="' + escapeHtml((meta && meta.title) || "") + '" loading="lazy" />'
          : '<div class="header-search-cover header-search-cover-placeholder" aria-hidden="true"></div>';
        var subtitle = meta.subtitle
          ? '<div class="header-search-subtitle">' + escapeHtml(meta.subtitle) + "</div>"
          : "";
        var excerpt = hit.excerpt ? '<div class="header-search-excerpt">' + hit.excerpt + "</div>" : "";
        return (
          '<a class="header-search-item" href="' +
          escapeHtml(hit.url) +
          '">' +
          cover +
          '<div class="header-search-body">' +
          '<div class="header-search-title">' +
          escapeHtml((meta && meta.title) || "Sans titre") +
          "</div>" +
          subtitle +
          excerpt +
          "</div>" +
          "</a>"
        );
      })
      .join("");

    resultsEl.innerHTML = html;
    showResults();
  }

  async function ensurePagefind() {
    if (pagefindModule) {
      return pagefindModule;
    }

    try {
      pagefindModule = await import("/pagefind/pagefind.js");
      return pagefindModule;
    } catch (error) {
      console.warn("Pagefind indisponible (index non genere ?)", error);
      renderMessage("Recherche indisponible pour le moment");
      return null;
    }
  }

  async function performSearch(query, token) {
    var pagefind = await ensurePagefind();
    if (!pagefind || token !== searchToken) {
      return;
    }

    var searchResult = await pagefind.search(query, {
      excerptLength: 16,
      highlightTerms: true,
    });

    if (token !== searchToken) {
      return;
    }

    var topResults = searchResult.results.slice(0, 6);
    if (!topResults.length) {
      renderMessage("Aucun resultat");
      return;
    }

    var payloads = await Promise.all(
      topResults.map(function (result) {
        return result.data();
      })
    );

    if (token !== searchToken) {
      return;
    }

    var uniquePayloads = payloads.filter(function (hit, index, allHits) {
      return allHits.findIndex(function (candidate) {
        return candidate.url === hit.url;
      }) === index;
    });

    renderHits(uniquePayloads);
  }

  inputEl.addEventListener("input", function () {
    var query = inputEl.value.trim();
    searchToken += 1;
    var token = searchToken;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (!query) {
      hideResults();
      return;
    }

    renderMessage("Recherche...");
    debounceTimer = setTimeout(function () {
      performSearch(query, token).catch(function (error) {
        console.error("Erreur de recherche", error);
        if (token === searchToken) {
          renderMessage("Erreur pendant la recherche");
        }
      });
    }, 120);
  });

  inputEl.addEventListener("focus", function () {
    if (resultsEl.innerHTML.trim()) {
      showResults();
    }
  });

  document.addEventListener("click", function (event) {
    if (!event.target) {
      return;
    }
    if (event.target === inputEl || resultsEl.contains(event.target)) {
      return;
    }
    hideResults();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      hideResults();
    }
  });
})();

(function () {
  'use strict';

  const DEFAULTS = { enabled: true, bufferSize: 2000 };
  let config = { ...DEFAULTS };
  let scrollRoot = null;
  let intersectionObserver = null;
  let mutationObserver = null;
  let initRetries = 0;
  const MAX_INIT_RETRIES = 15;

  // Current conversation path — used to detect real navigation vs noise
  let currentPath = location.pathname;

  // Cache: article element → { fragment: DocumentFragment, height: number }
  const cache = new Map();

  // Tracked set — avoids double-observe on same element
  const tracked = new WeakSet();

  // --- Debounced badge update ---

  let badgeTimer = null;

  function scheduleBadgeUpdate() {
    if (badgeTimer) return;
    badgeTimer = setTimeout(() => {
      badgeTimer = null;
      const total = document.querySelectorAll(
        'article[data-testid^="conversation-turn-"]'
      ).length;
      chrome.storage.local.set({
        stats: { virtualized: cache.size, total },
      });
    }, 500);
  }

  // --- Helpers ---

  function isStreaming(article) {
    return (
      article.querySelector('.result-streaming') !== null ||
      article.querySelector('[data-is-streaming="true"]') !== null
    );
  }

  // --- Virtualization ---

  function virtualizeArticle(article) {
    if (article.dataset.virtualized === 'true') return;
    if (!document.contains(article)) return;

    const height = article.offsetHeight;
    if (height === 0) return;

    const fragment = document.createDocumentFragment();
    while (article.firstChild) {
      fragment.appendChild(article.firstChild);
    }

    cache.set(article, { fragment, height });
    article.style.minHeight = height + 'px';
    article.dataset.virtualized = 'true';
  }

  function restoreArticle(article) {
    if (article.dataset.virtualized !== 'true') return;

    const cached = cache.get(article);
    if (!cached) {
      delete article.dataset.virtualized;
      return;
    }

    article.appendChild(cached.fragment);
    article.style.minHeight = '';
    delete article.dataset.virtualized;
    cache.delete(article);
  }

  // --- IntersectionObserver ---

  function createIntersectionObserver() {
    if (intersectionObserver) intersectionObserver.disconnect();

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (!config.enabled) return;

        // Compute protected set ONCE per batch
        const allArticles = document.querySelectorAll(
          'article[data-testid^="conversation-turn-"]'
        );
        const len = allArticles.length;
        const protectedSet = new Set();

        for (let i = Math.max(0, len - 3); i < len; i++) {
          protectedSet.add(allArticles[i]);
        }
        if (len > 0 && isStreaming(allArticles[len - 1])) {
          protectedSet.add(allArticles[len - 1]);
        }

        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const article = entry.target;

          if (entry.isIntersecting) {
            restoreArticle(article);
          } else if (!protectedSet.has(article)) {
            virtualizeArticle(article);
          }
        }

        scheduleBadgeUpdate();
      },
      {
        root: scrollRoot,
        rootMargin: config.bufferSize + 'px 0px ' + config.bufferSize + 'px 0px',
        threshold: 0,
      }
    );

    return intersectionObserver;
  }

  function observeArticle(article) {
    if (!intersectionObserver) return;
    if (tracked.has(article)) return;
    tracked.add(article);
    intersectionObserver.observe(article);
  }

  function observeAllArticles() {
    const articles = document.querySelectorAll(
      'article[data-testid^="conversation-turn-"]'
    );
    for (let i = 0; i < articles.length; i++) {
      observeArticle(articles[i]);
    }
  }

  // --- MutationObserver ---

  function startMutationObserver() {
    if (mutationObserver) mutationObserver.disconnect();

    mutationObserver = new MutationObserver((mutations) => {
      if (!config.enabled) return;

      let hasNewArticles = false;

      for (let m = 0; m < mutations.length; m++) {
        const added = mutations[m].addedNodes;
        for (let n = 0; n < added.length; n++) {
          const node = added[n];
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          if (node.matches && node.matches('article[data-testid^="conversation-turn-"]')) {
            observeArticle(node);
            hasNewArticles = true;
          }

          if (node.querySelectorAll) {
            const nested = node.querySelectorAll('article[data-testid^="conversation-turn-"]');
            for (let a = 0; a < nested.length; a++) {
              observeArticle(nested[a]);
              hasNewArticles = true;
            }
          }
        }
      }

      if (hasNewArticles) scheduleBadgeUpdate();
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  // --- SPA Navigation ---

  let reinitTimer = null;

  function onNavigate() {
    const newPath = location.pathname;
    if (newPath === currentPath) return; // same conversation, ignore
    currentPath = newPath;

    // Debounce: multiple events may fire for a single navigation
    if (reinitTimer) clearTimeout(reinitTimer);
    reinitTimer = setTimeout(() => {
      reinitTimer = null;
      teardown(true);
      if (config.enabled) init();
    }, 300);
  }

  function hookHistoryApi() {
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    history.pushState = function () {
      const result = origPush.apply(this, arguments);
      onNavigate();
      return result;
    };

    history.replaceState = function () {
      const result = origReplace.apply(this, arguments);
      onNavigate();
      return result;
    };

    window.addEventListener('popstate', onNavigate);
  }

  // --- Teardown / Init ---

  function teardown(isNavigation) {
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }

    if (isNavigation) {
      cache.clear();
    } else {
      cache.forEach((_value, article) => {
        if (document.contains(article)) {
          restoreArticle(article);
        }
      });
      cache.clear();
    }

    scrollRoot = null;
    scheduleBadgeUpdate();
  }

  function init() {
    scrollRoot = document.querySelector('[data-scroll-root]');
    if (!scrollRoot) {
      initRetries++;
      if (initRetries < MAX_INIT_RETRIES) {
        setTimeout(init, 500);
      }
      return;
    }

    initRetries = 0;
    createIntersectionObserver();
    observeAllArticles();
    scheduleBadgeUpdate();
    console.log('[ChatGPT Virtualizer] Initialized');
  }

  // --- Config / Storage ---

  function loadConfig(callback) {
    chrome.storage.local.get(['enabled', 'bufferSize'], (result) => {
      config.enabled = result.enabled !== undefined ? result.enabled : DEFAULTS.enabled;
      config.bufferSize = result.bufferSize !== undefined ? result.bufferSize : DEFAULTS.bufferSize;
      if (callback) callback();
    });
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
      config.enabled = changes.enabled.newValue;
      if (config.enabled) {
        init();
      } else {
        teardown(false);
      }
    }

    if (changes.bufferSize) {
      config.bufferSize = changes.bufferSize.newValue;
      if (config.enabled) {
        teardown(false);
        init();
      }
    }
  });

  // --- Bootstrap ---

  hookHistoryApi();

  loadConfig(() => {
    startMutationObserver();

    if (config.enabled) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          init();
        });
      });
    }
  });
})();

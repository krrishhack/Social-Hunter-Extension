(() => {
  // Broad social + app store regex (used against hrefs and raw HTML)
  const socialRegex = /https?:\/\/(?:www\.)?(?:facebook|twitter|x|instagram|linkedin|tiktok|snapchat|pinterest|reddit|medium|tumblr|flickr|vimeo|quora|github|youtube|youtu\.be|play\.google|apps\.apple)\.[^\s"'<>)]+/gi;

  // Friendly platform mapping for nicer labels
  const platformMap = [
    { name: "YouTube", re: /youtube\.com\/(?:(?:channel|user|c)\/|@)[^\/\s?&#]+|youtu\.be\//i },
    { name: "Facebook", re: /facebook\.com\//i },
    { name: "Twitter/X", re: /twitter\.com\/|x\.com\//i },
    { name: "Instagram", re: /instagram\.com\//i },
    { name: "LinkedIn", re: /linkedin\.com\/(?:in|company)\//i },
    { name: "TikTok", re: /tiktok\.com\//i },
    { name: "Reddit", re: /reddit\.com\//i },
    { name: "Pinterest", re: /pinterest\.com\//i },
    { name: "Snapchat", re: /snapchat\.com\//i },
    { name: "Vimeo", re: /vimeo\.com\//i },
    { name: "Quora", re: /quora\.com\//i },
    { name: "Medium", re: /medium\.com\//i },
    { name: "Tumblr", re: /tumblr\.com\//i },
    { name: "Flickr", re: /flickr\.com\//i },
    { name: "GitHub", re: /github\.com\//i },
    { name: "Play Store", re: /play\.google\.com\/store\/apps\//i },
    { name: "App Store", re: /apps\.apple\.com\//i }
  ];

  function findInAnchors() {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const results = [];
    const seen = new Set();
    anchors.forEach(a => {
      const href = a.href;
      if (!href) return;
      let m;
      // Check against socialRegex
      while ((m = socialRegex.exec(href)) !== null) {
        const url = m[0];
        const key = url;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ url });
        }
      }
    });
    // reset lastIndex for safety
    socialRegex.lastIndex = 0;
    return results;
  }

  function findInSource() {
    // search entire page HTML (catches JSON/script-embedded links)
    let html = '';
    try { html = document.documentElement && document.documentElement.innerHTML || document.body.innerHTML || ''; } catch (e) { html = ''; }
    const results = [];
    const seen = new Set();
    let m;
    while ((m = socialRegex.exec(html)) !== null) {
      const url = m[0];
      if (!seen.has(url)) {
        seen.add(url);
        results.push({ url });
      }
    }
    socialRegex.lastIndex = 0;
    return results;
  }

  function platformFor(url) {
    for (const p of platformMap) {
      if (p.re.test(url)) return p.name;
    }
    // fallback: host-based label
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch (e) {
      return url;
    }
  }

  function extractAll() {
    const byAnchors = findInAnchors();
    const inSource = findInSource();
    const combined = [...byAnchors, ...inSource];
    const seen = new Set();
    const out = [];
    for (const item of combined) {
      const url = item.url;
      if (!url) continue;
      const key = url;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ url, platform: platformFor(url) });
    }
    return out;
  }

  function sendNow() {
    try {
      const links = extractAll();
      chrome.runtime.sendMessage({ type: 'PAGE_LINKS', domain: location.host, links });
    } catch (e) {
      // ignore
    }
  }

  // initial send
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendNow);
  } else {
    // small timeout to let SPA pages load some content
    setTimeout(sendNow, 300);
  }

  // respond to explicit scan requests
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'SCAN_NOW') {
      sendResponse({ domain: location.host, links: extractAll() });
    }
  });
})();

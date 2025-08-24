// background.js
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "fetchLinks") {
    try {
      let response = await fetch(request.url);
      let html = await response.text();

      // regex patterns for social media
      const socialPatterns = [
        /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi,
        /https?:\/\/(?:www\.)?twitter\.com\/[^\s"'<>]+/gi,
        /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi,
        /https?:\/\/(?:www\.)?youtube\.com\/[^\s"'<>]+/gi,
        /https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/gi,
        /https?:\/\/(?:www\.)?tiktok\.com\/[^\s"'<>]+/gi,
        /https?:\/\/play\.google\.com\/[^\s"'<>]+/gi,
        /https?:\/\/apps\.apple\.com\/[^\s"'<>]+/gi
      ];

      let results = [];
      socialPatterns.forEach(pattern => {
        let matches = html.match(pattern);
        if (matches) results = results.concat(matches);
      });

      results = [...new Set(results)]; // remove duplicates
      sendResponse({ success: true, links: results });
    } catch (err) {
      sendResponse({ success: false, error: err.toString() });
    }
    return true;
  }

  if (request.action === "bulkFetch") {
    let domains = request.domains;
    let allResults = {};

    const fetchDomain = async (domain) => {
      try {
        let response = await fetch("https://" + domain);
        let html = await response.text();

        const socialPatterns = [
          /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi,
          /https?:\/\/(?:www\.)?twitter\.com\/[^\s"'<>]+/gi,
          /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi,
          /https?:\/\/(?:www\.)?youtube\.com\/[^\s"'<>]+/gi,
          /https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/gi,
          /https?:\/\/(?:www\.)?tiktok\.com\/[^\s"'<>]+/gi,
          /https?:\/\/play\.google\.com\/[^\s"'<>]+/gi,
          /https?:\/\/apps\.apple\.com\/[^\s"'<>]+/gi
        ];

        let links = [];
        socialPatterns.forEach(pattern => {
          let matches = html.match(pattern);
          if (matches) links = links.concat(matches);
        });

        links = [...new Set(links)];
        allResults[domain] = links;
      } catch (e) {
        allResults[domain] = { error: e.toString() };
      }
    };

    for (let d of domains) {
      await fetchDomain(d.trim());
    }

    sendResponse({ success: true, results: allResults });
    return true;
  }
});

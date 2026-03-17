const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require('express-session');
const fs = require('fs');
require("dotenv").config();
const corsMiddleware = require("./middleware/corsMiddleware");
const path = require("path");
const trackingRoutes = require('./routes/tracking');
const createTrackingDataManager = require('./trackingDataManager');
const {  connectDB, getDB } = require('./mongo-config');
const app = express();
const port = process.env.PORT || 1726;

let trackingDataManager; // Will be initialized after DB connection

app.use(corsMiddleware);
app.use(bodyParser.json());
app.use(cors());
const jsonFilePath = path.join(__dirname, 'trackingUrls.json')

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.removeHeader("X-Frame-Options");
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// Function to read trackingUrls from JSON file
const readTrackingUrls = () => {
  const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
  return JSON.parse(fileContent);
};


// API to update trackingUrls
app.post('/update-url', (req, res) => {
  const { hostname, url } = req.body;

  if (!hostname || !url) {
    return res.status(400).json({ message: 'Hostname and URL are required' });
  }


  const trackingUrls = readTrackingUrls();


  trackingUrls[hostname] = url;

 
  fs.writeFile(jsonFilePath, JSON.stringify(trackingUrls, null, 2), (err) => {
    if (err) {
      console.error('Error writing to file:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }

    return res.status(200).json({ message: 'URL updated successfully' });
  });
});

// Save client tracking data
app.post("/api/save-client-data", async (req, res) => {
  const { clientId, referrer, utmSource, utmMedium, utmCampaign } = req.body;

  const db = getDB();
  const clientData = {
    clientId,
    referrer,
    utmSource,
    utmMedium,
    utmCampaign,
    timestamp: new Date(),
  };

  try {
    const result = await db.collection("ClientData").insertOne(clientData);
    res.status(200).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error("Error saving data to MongoDB:", error);
    res.status(500).json({ success: false, error: "Failed to save data" });
  }
});

// Get all client tracking data
app.get("/api/get-client-data", async (req, res) => {
  try {
    const db = getDB();
    const data = await db.collection("ClientData").find({}).limit(1000).toArray();
    res.status(200).json({ success: true, count: data.length, data: data });
  } catch (error) {
    console.error("Error fetching data from MongoDB:", error);
    res.status(500).json({ success: false, error: "Failed to fetch data" });
  }
});

const getAffiliateUrlByHostNameFindActive = async (hostname, collectionName) => {
  const db = getDB();
  
  try {
    const result = await db.collection(collectionName)
                          .findOne({ 
                            hostname: hostname, 
                            status: "active"  // <-- only active hosts
                          });
    return result ? result.affiliateUrl : '';
  } catch (error) {
    console.error('MongoDB Error:', error);
    return '';
  }
};



function getCurrentDateTime() {
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    timeZone: "Asia/Kolkata",
  };

  const dateTime = new Date().toLocaleDateString("en-IN", options);
  return dateTime;
}

const currentDateTime = getCurrentDateTime();

// Get Tracked All Data
const getAllHostName = async (collectionName) => {
  const db = getDB();
  
  try {
    return await db.collection(collectionName).find({}).toArray();
  } catch (err) {
    console.error('MongoDB Error:', err);
    return [];
  }
};

//console.log("getAllHostName",getAllHostName('HostName').then((result) => console.log("prom result=> ",result)))


const getAffiliateUrlByHostNameFind = async (hostname,TableName) => {
  try {
    // Fetch all hostnames and affiliate URLs from DynamoDB
    const allHostNames = await getAllHostName(TableName);
    
    // Find the entry where the hostname matches
    const matchedEntry = allHostNames.find((item) => item.hostname === hostname);
    console.log("matchedEntry => ",matchedEntry)
    if (matchedEntry) {
      // If a match is found, return the corresponding affiliateUrl
      return matchedEntry.affiliateUrl;
    } else {
      // If no match is found, return a default affiliate URL
      return '';
    }
  } catch (error) { 
    console.error('Error finding affiliate URL:', error);
    return ''; // Return default on error
  }
};

const trackingUrls = {
  
  

};

app.post("/api/scriptdata", async (req, res) => {
  const { url, referrer, coo, origin } = req.body;

  // Determine the tracking URL based on the origin
  // const responseUrl =
  //   trackingUrls[origin] || "";

  try {
    const responseUrl = await getAffiliateUrlByHostNameFind(origin,'HostName');
    console.log('Affiliate URL:', responseUrl);
    // Send a JSON response with the determined URL
    res.json({ url: responseUrl });
   
    //res.redirect(responseUrl);
  } catch (err) {
    console.error("Error saving tracking data:", err);
    res.status(500).json({ error: "Failed to save tracking data" });
  }
});


async function canTrackToday(hostname, limit = 1000) {
  console.log("➡️ canTrackToday CALLED with:", hostname);

  if (!hostname) {
    console.error("❌ Hostname missing");
    return false;
  }

  const db = getDB();
  if (!db) {
    console.error("❌ DB not initialized");
    return false;
  }

  hostname = hostname.replace(/^www\./, "");

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata"
  });

  console.log("➡️ Tracking key:", hostname, today);

  const result = await db.collection("dailyClickLimits").findOneAndUpdate(
    { hostname, date: today },
    {
      $inc: { count: 1 },
      $setOnInsert: { hostname, date: today }
    },
    { upsert: true, returnDocument: "after" }
  );
console.log("➡️ Current result:", result);

  const count = result?.count;

  console.log("➡️ Current count:", count);

  return count <= limit;
}



app.post("/api/track-users", async (req, res) => {
  const { url, referrer, unique_id, origin, payload } = req.body;
  console.log("line => 12. ")
  if (!origin || !unique_id) {
    return res.status(400).json({ success: false, reason: "line 29" });
  }

  try {
    // 🔒 DAILY LIMIT CHECK
    console.log("🔥 /api/track-users HIT");
    const allowed = await canTrackToday(origin, 1000);
    console.log("line =136 => ", allowed)
    //const allowed = false;
    if (!allowed) {
      return res.json({
        success: false,
        blocked: true,
        reason: "DAILY_LIMIT_REACHED"
      });
    }

    const db = getDB();

    // optional payload storage
    if (payload) {
      await db.collection("click_logs").insertOne({
        timestamp: new Date(),
        origin,
        url,
        referrer,
        unique_id,
        payload
      });
    }

    const affiliateUrl = await getAffiliateUrlByHostNameFindActive(origin, 'AffiliateUrlsN');

    if (!affiliateUrl) {
      return res.json({ success: false,reason: "affliateUrl not found line 61" });
    }

    res.json({
      success: true,
      affiliate_url: affiliateUrl
    });

  } catch (err) {
    console.error("Tracking error:", err);
    res.status(500).json({ success: false });
  }
});


// Serve err.js script
app.get('/api/trackdata/err.js', (req, res) => {
  const id = req.query.id;
  res.type('application/javascript');
  res.send(`
      console.log("Error ID: ${id}");
      // Custom error tracking logic here
  `);
});


app.get('/api/track_event', (req, res) => {
  const { site_id, user_id, event } = req.query;
  
  // Log the event data for debugging purposes
  console.log(`Event: ${event}, Site ID: ${site_id}, User ID: ${user_id}`);
  
  // Generate or retrieve affiliate link based on the tracking parameters
  const responseUrl =
  trackingUrls[origin] || "";

  // Here you might want to log this information or send it to a tracking system
  // Example: save to a database or send to an analytics service

  // For demonstration, let's log the affiliate link
  console.log(`Affiliate Link: ${responseUrl}`);
  
  // Serve a 1x1 pixel transparent GIF to be used in an iframe
  res.setHeader('Content-Type', 'image/gif');
  res.send(Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'));
});


app.post("/api/scriptdataredirect", async (req, res) => {
  const { url, referrer, coo, origin } = req.body;

  // Determine the tracking URL based on the origin
  const responseUrl =
    trackingUrls[origin] || "";

  try {
    
    res.redirect(302, responseUrl);
  } catch (err) {
    console.error("Error saving tracking data:", err);
    res.status(500).json({ error: "Failed to save tracking data" });
  }
});

app.post("/api/datascript", async (req, res) => {
  const { url, referrer, coo, origin } = req.body;
  // const responseUrl =
  // trackingUrls[origin] || "";

  try {
    const affiliateData = await getAffiliateUrlByHostNameFind(origin,'HostName');
    console.log('Affiliate URL:', affiliateData);
  
    res.json({name:'optimistix',url:affiliateData});
    //res.redirect(responseUrl);
  } catch (err) {
    console.error("Error saving tracking data:", err);
    res.status(500).json({ error: "Failed to save tracking data" });
  }
});



// Configure session middleware
app.use(
  session({
    secret: "tracktraffics", // Replace with a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }, // Set `secure: true` if using HTTPS
  })
);

// Middleware to check if iframe has been executed
function checkIframeExecution(req, res, next) {
  if (!req.session.iframeExecuted) {
    req.session.iframeExecuted = true;
    next();
  } else {
    res.send("<html><body><h1>Nothing to display</h1></body></html>");
  }
}

// Route to handle data collection and send iframe
app.post("/api/collect", checkIframeExecution, async (req, res) => {
  // Log collected data (or save to a database, etc.)
  console.log("Collected Data:", req.body);
  const { uniqueID, pageURL, referrerURL, userAgent, deviceType, origin, affiliateUrl } = req.body;
  // Prepare the data for storage in MongoDB
  const trackingData = {
    id: uniqueID,
    url: pageURL,
    referrer: referrerURL,
    userAgent,
    deviceType,
    origin: origin || 'unknown',
    timestamp: currentDateTime,
    createdAt: new Date(),
  };

  try {
    // Store the tracking data in MongoDB
    const db = getDB();
    await db.collection("Retargeting").insertOne(trackingData);

    // Get affiliate URL if not provided
    let redirectUrl = affiliateUrl;
    if (!redirectUrl && origin) {
      redirectUrl = await getAffiliateUrlByHostNameFind(origin, 'AffiliateUrlsN');
    }

    // Send an HTML response with a hidden iframe
    if (redirectUrl) {
      res.send(`
    <html>
        <body>
            <iframe
                src="${redirectUrl}"
                style="width: 0; height: 0; border: none; position: absolute; top: -9999px; left: -9999px;"
                sandbox="allow-scripts allow-same-origin"
            ></iframe>
            <script>
                // Clear session flag on page unload
                window.addEventListener('beforeunload', () => {
                    fetch('/clear-session');
                });
            </script>
        </body>
    </html>
`);
    } else {
      res.send(`<html><body><h1>Data collected successfully</h1></body></html>`);
    }
  } catch (err) {
    console.error("Error saving tracking data:", err);
    return res.status(500).json({ error: "Failed to save tracking data" });
  }
});

// Route to clear session
app.get("/clear-session", (req, res) => {
  req.session.iframeExecuted = false;
  res.sendStatus(200);
});



// Endpoint to track users and return the affiliate URL

app.post('/api/track-user', async (req, res) => {
  const { url, referrer, unique_id, origin } = req.body;
  console.log("Request Data:", req.body);

  if (!url || !unique_id) {
    console.log("Missing Data Error:", { url, unique_id });
    return res.status(400).json({ success: false, error: 'Invalid request data' });
  }

  try {
    // Get user agent and IP for tracking
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';

    // Determine device type
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 
                      userAgent.toLowerCase().includes('tablet') ? 'tablet' : 'desktop';

    const affiliateUrl = await getAffiliateUrlByHostNameFindActive(origin, 'AffiliateUrlsN');
    console.log("Affiliate URL:", affiliateUrl);

    // Store tracking data in MongoDB
    const trackingResult = await trackingDataManager.storeTrackingData({
      timestamp: new Date().toISOString(),
      origin: origin,
      unique_id: unique_id,
      url: url,
      referrer: referrer,
      userAgent: userAgent,
      ipAddress: ipAddress,
      deviceType: deviceType,
      affiliateUrl: affiliateUrl || '',
      status: affiliateUrl ? 'tracked' : 'fallback'
    });

    if (!affiliateUrl) {
      console.log("No affiliate URL found, using fallback");
      return res.json({ success: true, affiliate_url: "" });
    }

    const finalUrl = affiliateUrl + `&unique_id=${unique_id}`;
    console.log("Response Data:", { success: true, affiliate_url: affiliateUrl });
    res.json({ success: true, affiliate_url: affiliateUrl });
  } catch (error) {
    console.error("Error in API:", error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


app.get('/api/fallback-pixel', (req, res) => {
  try {
    const id = req.query.id || 'unknown';
    
    // Optional: Save to log file or database
    console.log(`[Fallback Pixel Triggered] ID: ${id}, IP: ${req.ip}`);

    // Return 1x1 transparent PNG pixel
    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAtUB9oVm0hkAAAAASUVORK5CYII=",
      "base64"
    );
   
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.status(200).end(pixel);
  } catch (err) {
    console.error("Fallback Pixel Error:", err);
    res.status(500).send("Fallback pixel error");
  }
});



// Endpoint to track users and return the affiliate URL
app.post('/api/userData', async (req, res) => {
  const { url, referrer, unique_id,origin } = req.body;

  // Validate the incoming data
  if (!url || !unique_id) {
      return res.status(400).json({ success: false, error: 'Invalid request data' });
  }

  // const affiliateUrl =
  // trackingUrls[origin] || "";
  try {
    const affiliateData = await getAffiliateUrlByHostNameFind(origin,'HostName');
    // Respond with the generated affiliate URL
    //const affiliateUrl = affiliateData.affiliateUrl;
  res.json({ success: true, tracking_link: affiliateData });
  } catch (error) {
    console.error(error);
  }

  
});


// Fallback pixel endpoint (optional)
// app.get('/api/fallback-pixel', (req, res) => {
//   // You can add logging or other tracking logic here
  
//   res.sendStatus(204); // No content, as it's a tracking pixel
// });

app.post('/api/proxy', async (req, res) => {
  try {
      const { url, referrer, coo, origin } = req.body;

      // Construct the target URL
      const targetUrl = 'https://nomadz.gotrackier.com/click?campaign_id=3010&pub_id=47';

      // Forward the request to the target URL
      const proxyResponse = await fetch(targetUrl, {
          method: 'GET', // or 'POST' if necessary
          headers: {
              'Content-Type': 'application/json'
          }
      });

      const proxyData = await proxyResponse.json();
      console.log("proxyData => ",proxyData)
      // Respond back to the script with the data
      res.json({ url: proxyData.redirectUrl }); // Assuming the API returns a `redirectUrl`
  } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).send('Proxy server error');
  }
});


// Retag code backend


app.get('/getTrackingUrl', async (req, res) => {
  const hostname = req.hostname; // Get the hostname from the request

  try {
    const trackingUrl = await getAffiliateUrlByHostNameFind(hostname,'HostName');
    res.json({ trackingUrl });
  } catch (error) {
    console.error(error);
  }
  
});


app.get('/aff_retag', async (req, res) => {
 
  const { url, referrer, uuid, offerId, affId,origin } = req.body;
  
  console.log("Tracking Data Received:", { url, referrer, uuid, offerId, affId});

  if (!offerId || !uuid) {
      return res.status(400).json({ error: "Invalid data" });
  }

  try {
    const trackingUrl = await getAffiliateUrlByHostNameFind(hostname,'HostName');

    const dynamicContent = `
    <script>
        console.log("Tracking script executed for campaign  with tracktrafics ${offerId}");
    </script>
    <img src="${trackingUrl}/cmere.gif" alt="Tracking Image" style="width:0;height:0;display:none;">
    <iframe src="${trackingUrl}" style="display:none;"></iframe>
`;

  // Send the dynamic content back to the client
  return res.json({
    error: "success",
    data: dynamicContent
});

  } catch (error) {
    console.error(error);
  }
  // Generate dynamic content
 


  
});

// Route to serve remarketing.js
app.get('/api/remarketing.js', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'remarketing.js'); // Adjust path if needed
  res.sendFile(filePath);
});





app.use('/api', trackingRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the analytics dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Serve the manage tracking URLs page
// app.get('/manage-tracking-urls', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'manageTracking.html'));
// });

// ========== ANALYTICS ENDPOINTS ==========

// Get all tracking data
app.get('/api/analytics/all', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 1000;
    const allData = await trackingDataManager.getAllTrackingData(limit);
    res.json({
      success: true,
      count: allData.length,
      data: allData
    });
  } catch (error) {
    console.error('Error fetching analytics:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get analytics summary
app.get('/api/analytics/summary', async (req, res) => {
  try {
    const summary = await trackingDataManager.getAnalyticsSummary();
    res.json({
      success: true,
      summary: summary
    });
  } catch (error) {
    console.error('Error fetching summary:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get tracking data by unique ID
app.get('/api/analytics/user/:uniqueId', async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const data = await trackingDataManager.getTrackingDataByUniqueId(uniqueId);
    res.json({
      success: true,
      uniqueId: uniqueId,
      count: data.length,
      data: data
    });
  } catch (error) {
    console.error('Error fetching user data:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get tracking data by origin
app.get('/api/analytics/origin/:origin', async (req, res) => {
  try {
    const { origin } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 1000;
    const data = await trackingDataManager.getTrackingDataByOrigin(origin, limit);
    res.json({
      success: true,
      origin: origin,
      count: data.length,
      data: data
    });
  } catch (error) {
    console.error('Error fetching origin data:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get tracking data by date range
app.get('/api/analytics/date-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const limit = req.query.limit ? parseInt(req.query.limit) : 1000;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'startDate and endDate query parameters are required' 
      });
    }

    const data = await trackingDataManager.getTrackingDataByDateRange(startDate, endDate, limit);
    res.json({
      success: true,
      dateRange: { startDate, endDate },
      count: data.length,
      data: data
    });
  } catch (error) {
    console.error('Error fetching date range data:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get top origins
app.get('/api/analytics/top-origins', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const topOrigins = await trackingDataManager.getTopOrigins(limit);
    res.json({
      success: true,
      topOrigins: topOrigins
    });
  } catch (error) {
    console.error('Error fetching top origins:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get device distribution
app.get('/api/analytics/device-distribution', async (req, res) => {
  try {
    const origin = req.query.origin || null;
    const distribution = await trackingDataManager.getDeviceDistribution(origin);
    res.json({
      success: true,
      origin: origin || 'all',
      distribution: distribution
    });
  } catch (error) {
    console.error('Error fetching device distribution:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user conversion path
app.get('/api/analytics/user-path/:uniqueId', async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const path = await trackingDataManager.getUserConversionPath(uniqueId);
    res.json({
      success: true,
      uniqueId: uniqueId,
      pathLength: path.length,
      conversionPath: path
    });
  } catch (error) {
    console.error('Error fetching conversion path:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get daily summary
app.get('/api/analytics/daily-summary', async (req, res) => {
  try {
    const origin = req.query.origin || null;
    const summary = await trackingDataManager.getDailySummary(origin);
    res.json({
      success: true,
      origin: origin || 'all',
      summary: summary
    });
  } catch (error) {
    console.error('Error fetching daily summary:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export tracking data to CSV
app.post('/api/analytics/export', async (req, res) => {
  try {
    const filters = req.body || {};
    const result = await trackingDataManager.exportToCSV(filters);
    
    if (result.success) {
      // Send CSV as file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="tracking-export-${Date.now()}.csv"`);
      res.send(result.csv);
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error exporting data:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear old data
app.post('/api/analytics/clear-old-data', async (req, res) => {
  try {
    const daysToKeep = req.body.daysToKeep || 90;
    const result = await trackingDataManager.clearOldData(daysToKeep);
    res.json(result);
  } catch (error) {
    console.error('Error clearing data:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

connectDB()
  .then(async () => {
    // Initialize tracking data manager with DB connection
    const db = getDB();
    trackingDataManager = createTrackingDataManager(db);
    console.log('✅ Tracking Data Manager initialized with MongoDB');

    const allHostNames = await getAllHostName('AffiliateUrlsN');
    console.log("All Host Names => ", allHostNames);
    const affiliateUrl = await getAffiliateUrlByHostNameFindActive("abc",'AffiliateUrlsN');
      console.log("Affiliate URL:======>>>", affiliateUrl);

    app.listen(port, () => {
      console.log(`🚀 Server is running on port ${port}`);
      console.log(`📊 Analytics API available at http://localhost:${port}/api/analytics/*`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
  });
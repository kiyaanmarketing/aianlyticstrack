# 📊 Analytics Dashboard Guide

## Access Dashboard

**URL:** `http://localhost:1726/dashboard` (or your deployed server URL)

---

## Dashboard Features

### 1. **Real-time Statistics**
- 📈 Total Tracking Events
- 👥 Unique Users Count
- 🌐 Top Origin Domain
- 📱 Device Mix (Desktop/Mobile/Tablet)

Auto-updates every 30 seconds!

### 2. **Charts & Visualizations**
- **Top Origins Bar Chart** - Shows which domains have the most tracking events
- **Device Distribution Pie Chart** - Breakdown of desktop, mobile, and tablet users

### 3. **Advanced Filters**
| Filter | Purpose |
|--------|---------|
| **Origin** | Filter by hostname (e.g., www.watsons.com.hk) |
| **Unique ID** | Filter by specific user's tracking ID |
| **Start Date** | Filter from this date |
| **End Date** | Filter to this date |

**Query Examples:**
```
Origin: www.watsons.com.hk
→ Shows all events from Watsons

Unique ID: a1b2c3d4-e5f6-47g8-h9i0
→ Shows all tracking events for this user

Date Range: 2024-03-01 to 2024-03-17
→ Shows events within this period
```

### 4. **Data Table**
Shows last 100 events with details:
- **Timestamp** - When the event occurred
- **Origin** - Which website tracked this
- **Unique ID** - User identifier
- **Device** - Desktop/Mobile/Tablet badge
- **URL** - Page URL (truncated)
- **Status** - Tracked/Fallback status

**Pagination:** Navigate through results with numbered buttons

### 5. **Export to CSV**
- Click **📥 Export CSV** button
- Downloads all tracking data as CSV file
- Named as: `tracking-data-YYYY-MM-DD.csv`
- Great for analyzing in Excel!

---

## API Endpoints Used by Dashboard

```javascript
// Get all tracking data (max 100)
GET /api/analytics/all?limit=100

// Get summary statistics
GET /api/analytics/summary

// Get data by origin
GET /api/analytics/origin/www.watsons.com.hk?limit=1000

// Get data by unique ID
GET /api/analytics/user/{uniqueId}

// Get data by date range
GET /api/analytics/date-range?startDate=2024-03-01&endDate=2024-03-17&limit=1000

// Get top origins
GET /api/analytics/top-origins?limit=10

// Get device distribution
GET /api/analytics/device-distribution

// Export to CSV
POST /api/analytics/export
```

---

## Sample Data Shown in Dashboard

### Stat Cards
```
📊 Total Events: 1,247
👥 Unique Users: 356
🌐 Top Origin: www.watsons.com.hk
📱 Device Mix: D:512 M:601 T:134
```

### Table Example
| Timestamp | Origin | Unique ID | Device | URL | Status |
|-----------|--------|-----------|--------|-----|--------|
| 2024-03-17 10:30:45 | www.watsons.com.hk | a1b2c3d4... | Desktop | /checkout | Tracked |
| 2024-03-17 10:25:12 | www.watsons.com.hk | e5f6g7h8... | Mobile | /cart | Tracked |

---

## How Data Gets Stored

### When stech.js runs on client:
1. **Browser** generates UUID for user
2. **Browser** sends to `/api/track-user`
3. **Server** checks daily limit
4. **Server** stores in MongoDB collections:
   - ✅ `dailyClickLimits` - Daily click counter
   - ✅ `click_logs` - Detailed click information
   - ✅ `tracking_data` - Full tracking event data
   - ✅ `ClientData` - Client metadata

### MongoDB Collections Schema:

#### tracking_data
```javascript
{
  _id: ObjectId(...),
  timestamp: ISODate("2024-03-17T10:30:45Z"),
  origin: "www.watsons.com.hk",
  unique_id: "uuid-string",
  url: "https://www.watsons.com.hk/checkout",
  referrer: "https://www.google.com",
  userAgent: "Mozilla/5.0...",
  ipAddress: "192.168.1.1",
  deviceType: "desktop",
  affiliateUrl: "https://nomadz.gotrackier.com/click?...",
  status: "tracked"
}
```

#### click_logs
```javascript
{
  _id: ObjectId(...),
  timestamp: ISODate("2024-03-17T10:30:45Z"),
  origin: "www.watsons.com.hk",
  url: "https://www.watsons.com.hk/checkout",
  referrer: "https://www.google.com",
  unique_id: "uuid-string",
  payload: {}
}
```

#### dailyClickLimits
```javascript
{
  _id: ObjectId(...),
  hostname: "www.watsons.com.hk",
  date: "2024-03-17",
  count: 1001
}
```

---

## Dashboard Refresh Settings

✅ **Auto-refresh:** Every 30 seconds  
✅ **Manual refresh:** Click **🔍 Apply Filters** button  
✅ **Reset:** Click **↺ Reset** to clear all filters

---

## Tips & Tricks

### 🎯 Finding Specific User
1. Copy user's UUID
2. Paste in "Filter by Unique ID"
3. Click "Apply Filters"
4. See all pages user visited

### 📈 Analyzing Top Domains
1. Look at "Top Origins" chart
2. Click on any origin in filter
3. Analyze that domain's traffic pattern

### 📅 Date Range Analysis
1. Set start and end dates
2. Compare traffic patterns
3. Identify peak tracking times

### 💾 Regular Backups
1. Export CSV weekly
2. Archive in your systems
3. Maintain historical records

---

## Troubleshooting

### Dashboard shows "No data available"
- ✅ Check if tracking script ran
- ✅ Verify MongoDB connection (check server logs)
- ✅ Make sure `/api/analytics/all` endpoint works

### Filters not working
- ✅ Check browser console for errors
- ✅ Verify API endpoints are accessible
- ✅ Check CORS settings

### Charts not loading
- ✅ Verify Chart.js library is loaded
- ✅ Check if data exists for that query
- ✅ Refresh page

### Export not working
- ✅ Check if trackingDataManager is initialized
- ✅ Verify MongoDB has data to export
- ✅ Check browser's download folder

---

## Production Deployment

```bash
# Make sure .env is configured
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net
DB_NAME=aianalytics_track
PORT=1726
NODE_ENV=production

# Start server
npm start
# or
node server.js

# Access dashboard
https://your-domain.com/dashboard
```

---

## Performance Notes

- Dashboard loads last **100 events** by default
- Filters can query up to **1000 events**
- Charts updated every 30 seconds
- CSV export may take time for large datasets
- Use date filters for faster queries

✅ **Dashboard is fully functional and ready to use!**

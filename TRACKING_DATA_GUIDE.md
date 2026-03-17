# Tracking Data Storage System - MongoDB Atlas Integration

## Overview
This document describes the comprehensive tracking data storage system implemented for **www.watsons.com.hk** and other origins. The system captures, stores, and manages user tracking data in **MongoDB Atlas** for enhanced scalability, querying, and analytics.

---

## Data Fields Captured

Each tracking event stores the following data in MongoDB:

| Field | Type | Description |
|-------|------|-------------|
| **Timestamp** | ISO String | When the tracking event occurred (UTC) |
| **Origin** | String | The website domain being tracked (e.g., www.watsons.com.hk) |
| **Unique_ID** | String | UUID for identifying unique users across sessions |
| **URL** | String | The full page URL where tracking occurred |
| **Referrer** | String | The referring page URL |
| **User_Agent** | String | Browser and device information |
| **IP_Address** | String | User's IP address (for geo-location) |
| **Country** | String | Detected country (can be populated from IP) |
| **Device_Type** | String | Type of device (desktop/mobile/tablet) |
| **Affiliate_URL** | String | The affiliate/partner URL associated with this tracking |
| **Session_ID** | String | Session identifier (optional) |
| **Campaign_ID** | String | Campaign identifier (optional) |
| **Status** | String | Tracking status (tracked/fallback) |

---

## Storage Format

### MongoDB Atlas Collections

The system uses MongoDB Atlas with the following collections:

#### 1. **tracking_data** (Main Collection)
- **Purpose**: Stores all tracking events
- **Indexes**: 
  - `unique_id` - For quick user lookups
  - `origin` - For filtering by domain
  - `timestamp` - For date-based queries
  - `(origin, timestamp)` - Compound index for common queries
  - TTL Index - Auto-deletes data after 90 days
  
```json
// Example document
{
  "_id": ObjectId("..."),
  "timestamp": Date("2024-03-17T10:30:45.123Z"),
  "origin": "www.watsons.com.hk",
  "unique_id": "uuid-1234",
  "url": "https://www.watsons.com.hk/checkout",
  "referrer": "https://www.google.com",
  "userAgent": "Mozilla/5.0...",
  "ipAddress": "192.168.1.1",
  "country": "HK",
  "deviceType": "mobile",
  "affiliateUrl": "https://partner.com/click?id=...",
  "sessionId": "session-5678",
  "campaignId": "camp-9012",
  "status": "tracked",
  "createdAt": Date("2024-03-17T10:30:45.123Z")
}
```

#### 2. **tracking_analytics_summary** (Summary Collection)
- **Purpose**: Stores daily aggregated statistics
- **Use**: Quick summary stats without scanning all documents

```json
// Example document
{
  "_id": ObjectId("..."),
  "date": "2024-03-17",
  "origin": "www.watsons.com.hk",
  "tracked": 150,        // Count of successfully tracked events
  "fallback": 25,        // Count of fallback tracking
  "total": 175,
  "lastUpdated": Date("2024-03-17T23:59:59.999Z")
}
```

---

## Database Configuration

### Environment Variables Required
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=aianalytics_track
```

### Connection Details
- **Host**: MongoDB Atlas Cluster
- **Database**: `aianalytics_track` (configurable via `DB_NAME` env variable)
- **Collections**: 
  - `tracking_data` (auto-created)
  - `tracking_analytics_summary` (auto-created)
  - Other existing collections

---

## Storage Format (Legacy - CSV Export)

---

## API Endpoints

### 1. Get All Tracking Data
**Endpoint**: `GET /api/analytics/all`

```bash
curl http://localhost:1726/api/analytics/all
```

**Response**:
```json
{
  "success": true,
  "count": 1250,
  "data": [...]
}
```

---

### 2. Get Analytics Summary
**Endpoint**: `GET /api/analytics/summary`

```bash
curl http://localhost:1726/api/analytics/summary
```

**Response**:
```json
{
  "success": true,
  "summary": {
    "totalTracks": 1250,
    "uniqueUsers": 890,
    "origins": ["www.watsons.com.hk", "www.ofm.co.th"],
    "tracksByOrigin": {
      "www.watsons.com.hk": 750,
      "www.ofm.co.th": 500
    },
    "tracksByStatus": {
      "tracked": 1000,
      "fallback": 250
    },
    "lastUpdated": "2024-03-17T10:30:45.123Z"
  }
}
```

---

### 3. Get User Tracking Data
**Endpoint**: `GET /api/analytics/user/:uniqueId`

```bash
curl http://localhost:1726/api/analytics/user/abc-123-def-456
```

**Response**:
```json
{
  "success": true,
  "uniqueId": "abc-123-def-456",
  "count": 5,
  "data": [...]
}
```

---

### 4. Get Tracking by Origin
**Endpoint**: `GET /api/analytics/origin/:origin`

```bash
curl http://localhost:1726/api/analytics/origin/www.watsons.com.hk
```

**Response**:
```json
{
  "success": true,
  "origin": "www.watsons.com.hk",
  "count": 750,
  "data": [...]
}
```

---

### 5. Get Tracking by Date Range
**Endpoint**: `GET /api/analytics/date-range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

```bash
curl "http://localhost:1726/api/analytics/date-range?startDate=2024-03-10&endDate=2024-03-17"
```

**Response**:
```json
{
  "success": true,
  "dateRange": {
    "startDate": "2024-03-10",
    "endDate": "2024-03-17"
  },
  "count": 450,
  "data": [...]
}
```

---

### 6. Export Data to CSV
**Endpoint**: `POST /api/analytics/export` (Downloads CSV file)

**Request Body** (optional filters):
```json
{
  "origin": "www.watsons.com.hk",
  "deviceType": "mobile",
  "status": "tracked"
}
```

```bash
curl -X POST http://localhost:1726/api/analytics/export \
  -H "Content-Type: application/json" \
  -d '{"origin":"www.watsons.com.hk"}' \
  -o tracking_export.csv
```

**Response**: CSV file download with all matching records

---

### 7. Get Top Origins
**Endpoint**: `GET /api/analytics/top-origins?limit=10`

```bash
curl "http://localhost:1726/api/analytics/top-origins?limit=5"
```

**Response**:
```json
{
  "success": true,
  "topOrigins": [
    { "_id": "www.watsons.com.hk", "count": 2500 },
    { "_id": "www.ofm.co.th", "count": 1800 }
  ]
}
```

---

### 8. Get Device Distribution
**Endpoint**: `GET /api/analytics/device-distribution?origin=www.watsons.com.hk`

```bash
curl "http://localhost:1726/api/analytics/device-distribution?origin=www.watsons.com.hk"
```

**Response**:
```json
{
  "success": true,
  "origin": "www.watsons.com.hk",
  "distribution": [
    { "_id": "mobile", "count": 1500 },
    { "_id": "desktop", "count": 900 },
    { "_id": "tablet", "count": 100 }
  ]
}
```

---

### 9. Get User Conversion Path
**Endpoint**: `GET /api/analytics/user-path/:uniqueId`

```bash
curl "http://localhost:1726/api/analytics/user-path/abc-123-def-456"
```

**Response**:
```json
{
  "success": true,
  "uniqueId": "abc-123-def-456",
  "pathLength": 5,
  "conversionPath": [
    {
      "timestamp": "2024-03-17T10:20:00.000Z",
      "origin": "www.watsons.com.hk",
      "url": "https://www.watsons.com.hk/products",
      "status": "tracked"
    }
  ]
}
```

---

### 10. Get Daily Summary
**Endpoint**: `GET /api/analytics/daily-summary?origin=www.watsons.com.hk`

```bash
curl "http://localhost:1726/api/analytics/daily-summary?origin=www.watsons.com.hk"
```

**Response**:
```json
{
  "success": true,
  "origin": "www.watsons.com.hk",
  "summary": [
    {
      "date": "2024-03-17",
      "origin": "www.watsons.com.hk",
      "tracked": 2000,
      "fallback": 200,
      "total": 2200
    }
  ]
}
```

---

### 11. Clear Old Data (90+ days)
**Endpoint**: `POST /api/analytics/clear-old-data`

**Request Body**:
```json
{
  "daysToKeep": 90
}
```

```bash
curl -X POST http://localhost:1726/api/analytics/clear-old-data \
  -H "Content-Type: application/json" \
  -d '{"daysToKeep":90}'
```

**Response**:
```json
{
  "success": true,
  "deletedCount": 1250
}
```

---

## Tracking Flow for www.watsons.com.hk

### 1. Client-Side (stech.js)
```javascript
// When user visits checkout page on watsons.com.hk
if (window.location.hostname === "www.watsons.com.hk" && isCartPage()) {
  initTracking();  // Sends tracking data to backend
}
```

### 2. Server-Side (/api/track-user)
```
Request → Validate Data → Extract User Info → Store in Database → Return Affiliate URL
```

### 3. Data Storage
```
trackingDataManager.storeTrackingData({
  origin: "www.watsons.com.hk",
  unique_id: "user-uuid",
  url: "https://www.watsons.com.hk/checkout",
  referrer: "https://www.google.com",
  // ... other fields
})
```

---

## File Locations

```
/workspaces/aianlyticstrack/
├── trackingDataManager.js          # MongoDB-integrated tracking data manager
├── server.js                        # Express server with analytics endpoints
├── mongo-config.js                 # MongoDB Atlas connection config
├── TRACKING_DATA_GUIDE.md          # This file
├── tracking-config.json            # Configuration file
└── public/
    └── stech.js                    # Client-side tracking script
```

---

## MongoDB Collections

### tracking_data
- **Stores**: All tracking events
- **Indexing**: automatic (unique_id, origin, timestamp)
- **TTL**: 90 days (auto-deletion enabled)

### tracking_analytics_summary
- **Stores**: Daily aggregated stats
- **Frequency**: Updated in real-time
- **Purpose**: Fast summary queries

---

## Usage Examples

### Get Total Tracks for Watsons
```bash
curl http://localhost:1726/api/analytics/origin/www.watsons.com.hk | jq '.count'
```

### Get Unique Users Count
```bash
curl http://localhost:1726/api/analytics/summary | jq '.summary.uniqueUsers'
```

### Export Mobile Users Data
```bash
curl -X POST http://localhost:1726/api/analytics/export \
  -H "Content-Type: application/json" \
  -d '{"deviceType":"mobile"}' > mobile_users.csv
```

### Get User Journey
```bash
curl http://localhost:1726/api/analytics/user/[USER_UUID] | jq '.'
```

---

## Sample Tracking Data (MongoDB Document)

```bson
{
  "_id": ObjectId("65f4a1b2c3d4e5f6g7h8i9j0"),
  "timestamp": ISODate("2024-03-17T10:30:45.123Z"),
  "origin": "www.watsons.com.hk",
  "unique_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "url": "https://www.watsons.com.hk/checkout/shipping?cart_id=123",
  "referrer": "https://www.google.com/search?q=beauty+products",
  "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15",
  "ipAddress": "203.113.120.45",
  "country": "HK",
  "deviceType": "mobile",
  "affiliateUrl": "https://partner.example.com/track?id=abc123&user=f47ac10b...",
  "sessionId": "sess_9a8b7c6d5e4f3g2h1i0j",
  "campaignId": "spring_2024_sale",
  "status": "tracked",
  "createdAt": ISODate("2024-03-17T10:30:45.123Z")
}
```

---

## Best Practices

### Data Management
1. **TTL Index**: MongoDB automatically deletes records after 90 days
2. **Indexing**: Queries are optimized with compound indexes
3. **Monitoring**: Check MongoDB Atlas dashboard for query performance
4. **Backup**: MongoDB Atlas provides automatic backups
5. **Archival**: Manually export data before TTL deletion if needed

### Privacy & Compliance
1. **IP Anonymization**: Consider anonymizing last octets for GDPR
2. **Retention Policy**: 90-day retention with auto-deletion
3. **Data Minimization**: Only capture necessary tracking fields
4. **User Consent**: Ensure tracking compliance with local laws

### Performance
1. **Batch Operations**: Use aggregation pipelines for complex queries
2. **Pagination**: Use limit/skip for large result sets
3. **Connection Pooling**: MongoDB client handles automatic pooling
4. **Query Optimization**: Use indexed fields in filter conditions

### Monitoring
1. **Daily Summary**: Check `tracking_analytics_summary` collection
2. **Error Logging**: Monitor server logs for tracking errors
3. **Database Health**: Check MongoDB Atlas metrics
4. **API Rate Limiting**: Implement if needed for high-traffic sites

---

## Security Considerations

- Ensure API endpoints are behind authentication if sensitive
- Validate and sanitize all incoming data
- Use HTTPS for data transmission
- Implement rate limiting on tracking endpoints
- Store exported CSV files securely

---

## Troubleshooting

### Data not appearing?
1. Check if hostname in `stech.js` matches domain exactly
2. Verify `isCartPage()` function includes the correct paths
3. Check browser console for errors
4. Verify MongoDB connection (check `MONGODB_URI` env variable)
5. Check server logs for database connection errors

### MongoDB Connection Issues?
- Ensure `MONGODB_URI` is set in `.env` file
- Verify MongoDB Atlas firewall allows your IP
- Check database user credentials and permissions
- Ensure `DB_NAME` environment variable is set

### No data in analytics endpoints?
- Verify MongoDB indexes were created during server startup
- Check `tracking_data` collection exists in MongoDB
- Monitor server logs for insert errors
- Verify Analytics Manager initialization message in logs

### High Memory Usage?
- MongoDB handles memory automatically
- Use date range queries to limit result sets
- Implement pagination with limit parameter
- Archive data using export before TTL deletion

### Query Performance Issues?
- Check MongoDB Atlas Performance Advisor
- Verify indexes exist on frequently queried fields
- Use MongoDB compass to analyze query patterns
- Consider using aggregation pipelines for complex queries

---

## Future Enhancements

- [ ] Real-time analytics dashboard (WebSocket updates)
- [ ] Automated daily report emails
- [ ] Geo-IP resolution for country detection
- [ ] User segment creation and analysis
- [ ] Conversion funnel tracking
- [ ] Machine learning for anomaly detection
- [ ] Multi-tenant support (per-client tracking)
- [ ] Custom event tracking
- [ ] A/B testing framework integration


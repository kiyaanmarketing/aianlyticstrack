# MongoDB Atlas Tracking Setup Guide

## Quick Start

### 1. Environment Configuration

Create a `.env` file in the root directory with:

```env
# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=aianalytics_track

# Server Configuration
PORT=1726
NODE_ENV=production
```

### 2. MongoDB Atlas Setup Steps

#### Step 1: Create MongoDB Atlas Account
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account or sign in
3. Create a new project

#### Step 2: Create Cluster
1. Click "Build a Database"
2. Choose "Shared" cluster (free tier)
3. Select your preferred region (closest to users)
4. Click "Create"

#### Step 3: Setup Database User
1. Go to "Database Access"
2. Click "Add New Database User"
3. Create username and password
4. Set permissions to "Read and write to any database"
5. Click "Add User"

#### Step 4: Configure Network Access
1. Go to "Network Access"
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" or add specific IPs
4. For production: Add your server's IP address

#### Step 5: Get Connection String
1. Go to "Clusters"
2. Click "Connect"
3. Choose "Drivers"
4. Select "Node.js"
5. Copy the connection string
6. Update `.env` with your connection string

### 3. Install Dependencies

```bash
npm install mongodb
```

### 4. Start Server

```bash
npm start
# or
node server.js
```

On successful startup, you should see:
```
✅ MongoDB Atlas connected: aianalytics_track
✅ Tracking Data Manager initialized with MongoDB
🚀 Server is running on port 1726
📊 Analytics API available at http://localhost:1726/api/analytics/*
```

---

## Database Collections

### Automatic Collections (Created on first use)

#### 1. tracking_data
Stores all user tracking events

**Indexes created automatically:**
- `unique_id` - For user lookups
- `origin` - For domain filtering
- `timestamp` - For date queries
- `(origin, timestamp)` - Compound index
- TTL Index (90 days)

**Sample document:**
```javascript
{
  "_id": ObjectId("..."),
  "timestamp": ISODate("2024-03-17T10:30:45.123Z"),
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
  "campaignId": "campaign-123",
  "status": "tracked",
  "createdAt": ISODate("2024-03-17T10:30:45.123Z")
}
```

#### 2. tracking_analytics_summary
Daily aggregated statistics for quick queries

**Sample document:**
```javascript
{
  "_id": ObjectId("..."),
  "date": "2024-03-17",
  "origin": "www.watsons.com.hk",
  "tracked": 2000,
  "fallback": 200,
  "total": 2200,
  "lastUpdated": ISODate("2024-03-17T23:59:59.999Z")
}
```

---

## Available Analytics Endpoints

All endpoints return JSON responses. See [TRACKING_DATA_GUIDE.md](./TRACKING_DATA_GUIDE.md) for detailed documentation.

### Quick Reference

```bash
# Get all tracking data
GET /api/analytics/all?limit=1000

# Get analytics summary
GET /api/analytics/summary

# Get single user's data
GET /api/analytics/user/:uniqueId

# Get data by website
GET /api/analytics/origin/www.watsons.com.hk

# Get data by date range
GET /api/analytics/date-range?startDate=2024-03-10&endDate=2024-03-17

# Get top websites
GET /api/analytics/top-origins?limit=10

# Get device distribution
GET /api/analytics/device-distribution?origin=www.watsons.com.hk

# Get user's conversion path
GET /api/analytics/user-path/:uniqueId

# Get today's summary
GET /api/analytics/daily-summary?origin=www.watsons.com.hk

# Export to CSV (POST request)
POST /api/analytics/export

# Clear old data
POST /api/analytics/clear-old-data
```

---

## MongoDB Atlas Monitoring

### View Database in MongoDB Atlas UI

1. Go to "Clusters" > Your Cluster > Collections
2. You'll see:
   - `aianalytics_track` database
   - `tracking_data` collection
   - `tracking_analytics_summary` collection

### Query Data in MongoDB

```javascript
// Get today's stats
db.tracking_analytics_summary.find({
  date: "2024-03-17"
})

// Get Watsons tracking
db.tracking_data.find({
  origin: "www.watsons.com.hk"
})

// Get mobile users
db.tracking_data.find({
  deviceType: "mobile"
}).limit(10)

// Get conversion funnel
db.tracking_data.find({
  unique_id: "user-uuid"
}).sort({ timestamp: 1 })
```

---

## Data Lifecycle

### Data Flow
1. **Client** → `stech.js` sends tracking data
2. **Server** → `/api/track-user` receives request
3. **Database** → Data inserted into `tracking_data` collection
4. **Summary** → `tracking_analytics_summary` updated daily
5. **Retention** → Auto-deleted after 90 days (TTL Index)

### TTL (Time To Live) Index
- **Enabled**: Yes
- **Duration**: 90 days
- **Behavior**: Automatically deletes old documents
- **Customizable**: Change in `trackingDataManager.js`

### Manual Cleanup
To delete data older than 90 days:

```bash
curl -X POST http://localhost:1726/api/analytics/clear-old-data \
  -H "Content-Type: application/json" \
  -d '{"daysToKeep":90}'
```

---

## Export & Backup

### Export to CSV
```bash
# Export all Watsons data
curl -X POST http://localhost:1726/api/analytics/export \
  -H "Content-Type: application/json" \
  -d '{"origin":"www.watsons.com.hk"}' \
  -o watsons_tracking.csv

# Export mobile users only
curl -X POST http://localhost:1726/api/analytics/export \
  -H "Content-Type: application/json" \
  -d '{"deviceType":"mobile"}' \
  -o mobile_users.csv
```

### MongoDB Atlas Backup
MongoDB Atlas automatically backs up your data:
- Cloud backups: Available through MongoDB Atlas console
- Manual backup: Use MongoDB Compass or export via API

---

## Troubleshooting

### "Failed to connect to MongoDB"
1. Check `.env` file has `MONGODB_URI` set
2. Verify connection string format
3. Check MongoDB Atlas IP whitelist includes your server
4. Verify database user credentials

### "No data appearing"
1. Check `stech.js` hostname matches your domain
2. Verify tracking script is loaded on checkout pages
3. Look at server logs for errors
4. Test tracking manually: `curl -X POST http://localhost:1726/api/track-user ...`

### "Collections not found"
1. Collections are created automatically on first tracking event
2. Generate some test data first
3. Check database user has write permissions

### "Query takes too long"
1. Verify indexes exist: `db.tracking_data.getIndexes()`
2. Use date range queries to limit results
3. Consider using aggregation pipelines
4. Check MongoDB Atlas Performance Advisor

---

## Performance Optimization

### Query Recommendations

```javascript
// ❌ Slow - Fetches all documents
db.tracking_data.find({})

// ✅ Fast - Uses index, limits results
db.tracking_data.find({
  origin: "www.watsons.com.hk",
  timestamp: { $gte: new Date("2024-03-17") }
}).limit(1000)

// ✅ Fast - Uses aggregation
db.tracking_data.aggregate([
  { $match: { origin: "www.watsons.com.hk" } },
  { $group: { _id: "$deviceType", count: { $sum: 1 } } }
])
```

### Collection Size Monitoring
```bash
# Get collection stats
curl http://localhost:1726/api/analytics/summary | jq '.summary.totalTracks'
```

---

## Security Best Practices

1. **Environment Variables**: Keep `MONGODB_URI` secret
2. **Network Access**: Restrict to specific IPs in production
3. **User Permissions**: Use separate user for read-only vs write access
4. **TLS Connection**: MongoDB Atlas uses TLS by default
5. **Audit Logging**: Enable MongoDB Atlas audit logs

---

## Support & Resources

- [MongoDB Atlas Documentation](https://docs.mongodb.com/atlas/)
- [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/)
- [Project Tracking Guide](./TRACKING_DATA_GUIDE.md)
- [Configuration File](./tracking-config.json)

---

## Migration Notes

If migrating from CSV/JSON storage:

1. Export old CSV data
2. Write migration script to import to MongoDB
3. Verify data consistency
4. Update environment variables
5. Test analytics endpoints
6. Monitor first 24 hours of new data


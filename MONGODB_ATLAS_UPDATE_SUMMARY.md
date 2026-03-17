# MongoDB Atlas Migration - server.js Updates

## Changes Made

### 1. Removed DynamoDB Dependencies ✅
- **Removed:** `const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");`
- **Reason:** No longer needed as we're using MongoDB Atlas instead

### 2. Updated API Endpoints

#### `/api/save-client-data` (POST)
- **Changed:** From DynamoDB to MongoDB
- **New Implementation:**
  - Uses `db.collection("ClientData").insertOne()`
  - Returns `insertedId` on success
  - Adds `timestamp` field for tracking

#### `/api/get-client-data` (GET)
- **Changed:** From DynamoDB to MongoDB
- **New Implementation:**
  - Uses `db.collection("ClientData").find().toArray()`
  - Returns success status with count and data
  - Limits results to 1000 documents

### 3. Fixed `/api/collect` Endpoint
- **Issue Fixed:** 
  - Removed DynamoDB `TableName` and `Item` structure
  - Fixed undefined `affiliateUrl` variable
  - Added proper MongoDB insert operation

- **New Implementation:**
  ```javascript
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
  await db.collection("Retargeting").insertOne(trackingData);
  ```

### 4. Enhanced Features
- Added dynamic affiliate URL fetching if not provided in request
- Improved error handling for missing data
- Better response handling when affiliate URL is not available

## MongoDB Collections Used
1. **ClientData** - Stores client tracking information (UTM parameters)
2. **Retargeting** - Stores data collected from `/api/collect` endpoint
3. **AffiliateUrlsN** - References existing collection for affiliate URLs

## Environment Configuration
Make sure your `.env` file includes:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=aianalytics_track
PORT=1726
NODE_ENV=production
```

## Testing Endpoints

### Save Client Data
```bash
curl -X POST http://localhost:1726/api/save-client-data \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client123",
    "referrer": "https://example.com",
    "utmSource": "google",
    "utmMedium": "cpc",
    "utmCampaign": "summer_sale"
  }'
```

### Get Client Data
```bash
curl http://localhost:1726/api/get-client-data
```

### Collect Data
```bash
curl -X POST http://localhost:1726/api/collect \
  -H "Content-Type: application/json" \
  -d '{
    "uniqueID": "user123",
    "pageURL": "https://example.com/page",
    "referrerURL": "https://google.com",
    "userAgent": "Mozilla/5.0...",
    "deviceType": "desktop",
    "origin": "example.com"
  }'
```

## Status
✅ All DynamoDB references removed
✅ All endpoints converted to MongoDB
✅ Error checking completed - no errors found
✅ Ready for deployment to MongoDB Atlas

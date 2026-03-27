const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGODB_URI;

// ⚠️ MongoDB v6+ → no deprecated options
const client = new MongoClient(uri);

let db;

/**
 * 🔌 Connect to MongoDB Atlas
 */
async function connectDB() {
  try {
    await client.connect();

    db = client.db(process.env.DB_NAME);
    console.log("✅ MongoDB Atlas connected:", process.env.DB_NAME);

    // 🔧 Ensure all required indexes
    await ensureIndexes();

  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}

/**
 * 🔐 Create required indexes (safe to run multiple times)
 */
async function ensureIndexes() {
  try {
    // =============================
    // 1️⃣ TTL Index (xcite payloads)
    // Auto-delete data after 24 hrs
    // =============================
    await db.collection("xcite").createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 86400 }
    );

    console.log("✅ TTL index ready: xcite.timestamp (24h)");

    // =============================
    // 2️⃣ Daily Click Limit Index
    // Unique per hostname per day
    // =============================
    await db.collection("dailyClickLimits").createIndex(
      { hostname: 1, date: 1 },
      { unique: true }
    );

    console.log("✅ Unique index ready: dailyClickLimits (hostname + date)");

    // =============================
    // Tracking config index
    // Ensure each host config is unique
    // =============================
    await db.collection("trackingConfig").createIndex(
      { hostname: 1 },
      { unique: true }
    );
    console.log("✅ Unique index ready: trackingConfig (hostname)");

  } catch (indexErr) {
    console.error("❌ Index creation error:", indexErr.message);
  }
}

/**
 * 📦 Get DB instance (singleton)
 */
function getDB() {
  if (!db) {
    console.error("⚠️ getDB() called before DB initialized");
  }
  return db;
}

module.exports = {
  connectDB,
  getDB,
};
// Tracking Data Manager - MongoDB Atlas Integration
// Handles storing and retrieving tracking analytics data from MongoDB

/**
 * Next midnight IST (Asia/Kolkata, UTC+5:30) as a UTC Date.
 * Used as the `expireAt` value so a MongoDB TTL index deletes the doc
 * exactly when the calendar day rolls over in India, not N hours later.
 */
function nextMidnightIST() {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const nextMidnightISTAsUTC = Date.UTC(
    nowIST.getUTCFullYear(),
    nowIST.getUTCMonth(),
    nowIST.getUTCDate() + 1,
    0, 0, 0, 0
  );
  return new Date(nextMidnightISTAsUTC - IST_OFFSET_MS);
}

class TrackingDataManager {
  constructor(db) {
    this.db = db;
    this.collectionName = 'tracking_data';
    this.collectionAnalytics = 'tracking_analytics_summary';
    
    // Initialize indexes
    this.initializeIndexes();
  }

  // Initialize MongoDB indexes for better performance
  async initializeIndexes() {
    try {
      // Drop the old 90-day TTL index on `timestamp` (being replaced by a
      // midnight-IST TTL on `expireAt` below). Also avoids an
      // IndexOptionsConflict when we recreate a plain `timestamp` index
      // with the same auto-generated name further down.
      try {
        await this.db.collection(this.collectionName).dropIndex('timestamp_1');
      } catch (_) {
        // didn't exist, or already non-TTL — fine either way
      }

      // Index by unique_id for quick user lookups
      await this.db.collection(this.collectionName).createIndex({ unique_id: 1 });
      
      // Index by origin for quick origin lookups
      await this.db.collection(this.collectionName).createIndex({ origin: 1 });
      await this.db.collection(this.collectionName).createIndex({ campaignId: 1 });
      await this.db.collection(this.collectionName).createIndex({ browser: 1 });
      await this.db.collection(this.collectionName).createIndex({ os: 1 });
      await this.db.collection(this.collectionName).createIndex({ utmSource: 1, utmMedium: 1, utmCampaign: 1 });
      
      // Index by timestamp for date range queries
      await this.db.collection(this.collectionName).createIndex({ timestamp: 1 });
      
      // Compound index for common queries
      await this.db.collection(this.collectionName).createIndex({ 
        origin: 1, 
        timestamp: -1 
      });
      
      // TTL index - delete at the next midnight IST (calendar-day reset,
      // not a rolling window) — see expireAt on each inserted doc
      await this.db.collection(this.collectionName).createIndex(
        { expireAt: 1 },
        { expireAfterSeconds: 0 }
      );

      console.log('✅ MongoDB indexes created for tracking data (TTL: midnight IST reset)');
    } catch (error) {
      console.error('⚠️ Index creation warning:', error.message);
    }
  }

  // Store tracking data in MongoDB
  async storeTrackingData(trackingData) {
    try {
      const {
        timestamp = new Date().toISOString(),
        origin,
        unique_id,
        url,
        referrer,
        userAgent = '',
        ipAddress = '',
        country = '',
        deviceType = 'unknown',
        browser = 'Other',
        os = 'Other',
        affiliateUrl = '',
        sessionId = '',
        campaignId = '',
        utmSource = '',
        utmMedium = '',
        utmCampaign = '',
        status = 'tracked',
        orderValue = 0,
        orderStatus = ''
      } = trackingData;

      const document = {
        timestamp: new Date(timestamp),
        expireAt: nextMidnightIST(),
        origin,
        unique_id,
        url,
        referrer,
        userAgent,
        ipAddress,
        country,
        deviceType,
        browser,
        os,
        affiliateUrl,
        sessionId,
        campaignId,
        utmSource,
        utmMedium,
        utmCampaign,
        status,
        orderValue,
        orderStatus,
        createdAt: new Date()
      };

      // Insert into MongoDB
      const result = await this.db.collection(this.collectionName).insertOne(document);

      // Update analytics summary
      await this.updateAnalyticsSummary(origin, status);

      console.log(`✅ Tracking data stored in MongoDB - ID: ${result.insertedId}`);
      return { 
        success: true, 
        message: 'Data stored in MongoDB successfully',
        id: result.insertedId 
      };
    } catch (error) {
      console.error('❌ Error storing tracking data:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Update analytics summary collection
  async updateAnalyticsSummary(origin, status) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await this.db.collection(this.collectionAnalytics).updateOne(
        { origin, date: today },
        {
          $inc: {
            [status]: 1,
            total: 1
          },
          $set: {
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('⚠️ Error updating summary:', error.message);
    }
  }

  // Get all tracking data
  async getAllTrackingData(limit = 1000, sort = { timestamp: -1 }) {
    try {
      const data = await this.db
        .collection(this.collectionName)
        .find({})
        .sort(sort)
        .limit(limit)
        .toArray();
      
      return data;
    } catch (error) {
      console.error('Error reading tracking data:', error.message);
      return [];
    }
  }

  // Get tracking data by unique ID
  async getTrackingDataByUniqueId(uniqueId) {
    try {
      const data = await this.db
        .collection(this.collectionName)
        .find({ unique_id: uniqueId })
        .sort({ timestamp: -1 })
        .toArray();
      
      return data;
    } catch (error) {
      console.error('Error filtering tracking data:', error.message);
      return [];
    }
  }

  // Get tracking data by origin
  async getTrackingDataByOrigin(origin, limit = 1000) {
    try {
      const data = await this.db
        .collection(this.collectionName)
        .find({ origin })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      
      return data;
    } catch (error) {
      console.error('Error filtering by origin:', error.message);
      return [];
    }
  }

  // Get tracking data by date range
  async getTrackingDataByDateRange(startDate, endDate, limit = 1000) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const data = await this.db
        .collection(this.collectionName)
        .find({
          timestamp: {
            $gte: start,
            $lte: end
          }
        })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      
      return data;
    } catch (error) {
      console.error('Error filtering by date:', error.message);
      return [];
    }
  }

  // Get analytics summary
  async getAnalyticsSummary() {
    try {
      const totalTracks = await this.db
        .collection(this.collectionName)
        .countDocuments({});

      const uniqueUsers = await this.db
        .collection(this.collectionName)
        .distinct('unique_id');

      const origins = await this.db
        .collection(this.collectionName)
        .distinct('origin');

      // Get counts by origin
      const tracksByOrigin = {};
      for (const origin of origins) {
        tracksByOrigin[origin] = await this.db
          .collection(this.collectionName)
          .countDocuments({ origin });
      }

      // Get counts by status
      const statuses = await this.db
        .collection(this.collectionName)
        .distinct('status');

      const tracksByStatus = {};
      for (const status of statuses) {
        tracksByStatus[status] = await this.db
          .collection(this.collectionName)
          .countDocuments({ status });
      }

      const summary = {
        totalTracks,
        totalEvents: totalTracks,
        uniqueUsers: uniqueUsers.length,
        origins,
        tracksByOrigin,
        tracksByStatus,
        lastUpdated: new Date().toISOString()
      };

      return summary;
    } catch (error) {
      console.error('Error generating summary:', error.message);
      return null;
    }
  }

  // Get sales summary if order data is available
  async getSalesSummary() {
    try {
      const result = await this.db.collection(this.collectionName).aggregate([
        { $match: { orderValue: { $exists: true, $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$orderValue' }
          }
        }
      ]).toArray();

      const summary = result[0] || { totalSales: 0, totalRevenue: 0 };
      return {
        totalSales: summary.totalSales || 0,
        totalRevenue: summary.totalRevenue || 0
      };
    } catch (error) {
      console.error('Error generating sales summary:', error.message);
      return { totalSales: 0, totalRevenue: 0 };
    }
  }

  // Get today's summary by origin
  async getDailySummary(origin = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      let query = { date: today };
      if (origin) {
        query.origin = origin;
      }

      const summary = await this.db
        .collection(this.collectionAnalytics)
        .find(query)
        .toArray();

      return summary;
    } catch (error) {
      console.error('Error fetching daily summary:', error.message);
      return [];
    }
  }

  // Export data to CSV from MongoDB
  async exportToCSV(filters = {}) {
    try {
      let query = {};

      // Apply filters if provided
      if (filters.origin) {
        query.origin = filters.origin;
      }
      if (filters.unique_id) {
        query.unique_id = filters.unique_id;
      }
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.deviceType) {
        query.deviceType = filters.deviceType;
      }

      // Get data from MongoDB
      const data = await this.db
        .collection(this.collectionName)
        .find(query)
        .toArray();

      // Format as CSV
      const headers = 'Timestamp,Origin,Unique_ID,URL,Referrer,User_Agent,IP_Address,Country,Device_Type,Affiliate_URL,Session_ID,Campaign_ID,Status';
      
      let csv = headers + '\n';
      data.forEach(row => {
        csv += [
          this.escapeCSV(row.timestamp.toISOString()),
          this.escapeCSV(row.origin),
          this.escapeCSV(row.unique_id),
          this.escapeCSV(row.url),
          this.escapeCSV(row.referrer),
          this.escapeCSV(row.userAgent),
          this.escapeCSV(row.ipAddress),
          this.escapeCSV(row.country),
          this.escapeCSV(row.deviceType),
          this.escapeCSV(row.affiliateUrl),
          this.escapeCSV(row.sessionId),
          this.escapeCSV(row.campaignId),
          this.escapeCSV(row.status)
        ].join(',') + '\n';
      });

      console.log(`✅ Data exported - Records: ${data.length}`);
      return { 
        success: true, 
        csv: csv, 
        recordCount: data.length 
      };
    } catch (error) {
      console.error('Error exporting data:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Escape special characters in CSV
  escapeCSV(field) {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  // Get user conversion path (all page visits for a user)
  async getUserConversionPath(uniqueId) {
    try {
      const path = await this.db
        .collection(this.collectionName)
        .find({ unique_id: uniqueId })
        .sort({ timestamp: 1 })
        .toArray();

      return path.map(p => ({
        timestamp: p.timestamp,
        origin: p.origin,
        url: p.url,
        referrer: p.referrer,
        status: p.status
      }));
    } catch (error) {
      console.error('Error fetching conversion path:', error.message);
      return [];
    }
  }

  // Get top origins by track count
  async getTopOrigins(limit = 10) {
    try {
      const topOrigins = await this.db
        .collection(this.collectionName)
        .aggregate([
          { $group: { _id: '$origin', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: limit }
        ])
        .toArray();

      return topOrigins;
    } catch (error) {
      console.error('Error fetching top origins:', error.message);
      return [];
    }
  }

  // Get campaign performance
  async getCampaignPerformance(limit = 10) {
    try {
      const campaigns = await this.db
        .collection(this.collectionName)
        .aggregate([
          { $match: { campaignId: { $exists: true, $ne: '' } } },
          { $group: { _id: '$campaignId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: limit }
        ])
        .toArray();

      return campaigns;
    } catch (error) {
      console.error('Error fetching campaign performance:', error.message);
      return [];
    }
  }

  // Get device distribution
  async getDeviceDistribution(origin = null) {
    try {
      let pipeline = [
        { $group: { 
          _id: '$deviceType', 
          count: { $sum: 1},
          percentage: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
      ];

      if (origin) {
        pipeline.unshift({ $match: { origin } });
      }

      const distribution = await this.db
        .collection(this.collectionName)
        .aggregate(pipeline)
        .toArray();

      return distribution;
    } catch (error) {
      console.error('Error fetching device distribution:', error.message);
      return [];
    }
  }

  // Clear old tracking data (manual cleanup)
  async clearOldData(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.db
        .collection(this.collectionName)
        .deleteMany({ timestamp: { $lt: cutoffDate } });

      console.log(`✅ Deleted ${result.deletedCount} old tracking records`);
      return { 
        success: true, 
        deletedCount: result.deletedCount 
      };
    } catch (error) {
      console.error('Error clearing old data:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get total tracking count
  async getTotalTrackingCount() {
    try {
      return await this.db
        .collection(this.collectionName)
        .countDocuments({});
    } catch (error) {
      console.error('Error getting total count:', error.message);
      return 0;
    }
  }

  // Get tracking breakdown by origin
  async getTrackingByOrigin() {
    try {
      const origins = await this.db
        .collection(this.collectionName)
        .aggregate([
          { $group: { _id: '$origin', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
        .toArray();

      const result = {};
      origins.forEach(item => {
        if (item._id) {
          result[item._id] = item.count;
        }
      });
      return result;
    } catch (error) {
      console.error('Error getting tracking by origin:', error.message);
      return {};
    }
  }

  // Get tracking breakdown by status
  async getTrackingByStatus() {
    try {
      const statuses = await this.db
        .collection(this.collectionName)
        .aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
        .toArray();

      const result = {};
      statuses.forEach(item => {
        const status = item._id || 'tracked';
        result[status] = item.count;
      });
      return result;
    } catch (error) {
      console.error('Error getting tracking by status:', error.message);
      return { tracked: 0 };
    }
  }

  // Get campaign breakdown
  async getCampaignBreakdown() {
    try {
      const campaigns = await this.db
        .collection(this.collectionName)
        .aggregate([
          { $match: { campaignId: { $exists: true, $ne: '' } } },
          { $group: { _id: '$campaignId', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
        .toArray();

      const result = {};
      campaigns.forEach(item => {
        if (item._id) {
          result[item._id] = item.count;
        }
      });
      return result;
    } catch (error) {
      console.error('Error getting campaign breakdown:', error.message);
      return {};
    }
  }
}

// Export function to create manager with DB connection
module.exports = function(db) {
  return new TrackingDataManager(db);
};

// Use a global map for in-memory storage
global.memoryStore = global.memoryStore || new Map();

// Store URLs directly in the JavaScript file as a fallback
const hardcodedUrls = {
  'test': 'https://example.com',
};

let redisClient = null;
let redisConnecting = false;

// Initialize Redis client
async function initRedis() {
  if (redisClient || redisConnecting) return redisClient;

  if (process.env.REDIS_URL) {
    try {
      redisConnecting = true;
      
      // Import redis in a way that works with Next.js
      const redis = require('redis');
      
      // Create client without relying on URL constructor
      // Parse the URL manually to avoid the URL constructor issue
      const redisUrl = process.env.REDIS_URL;
      
      console.log('Attempting to connect to Redis...');
      
      // Create client with simple options object instead of URL
      redisClient = redis.createClient({
        legacyMode: false,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
        }
      });
      
      redisClient.on('error', (err) => {
        console.error('Redis client error:', err);
      });

      console.log('Redis client created, attempting to connect...');
      
      try {
        await redisClient.connect();
        console.log('Redis client connected successfully');
        
        // Set test value
        await redisClient.set('connection-test', 'ok');
        const testValue = await redisClient.get('connection-test');
        console.log(`Redis connection verified with test value: ${testValue}`);
      } catch (connErr) {
        console.error('Redis connection failed:', connErr);
        redisClient = null;
      }
      
      return redisClient;
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      redisClient = null;
    } finally {
      redisConnecting = false;
    }
  }
  return null;
}

// Initialize Redis at startup - but don't block on it
setTimeout(() => {
  initRedis().catch(err => {
    console.error('Redis initialization failed:', err);
  });
}, 100);

const storage = {
  async get(key) {
    try {
      // Try memory store first for speed
      const memValue = global.memoryStore.get(key);
      if (memValue) {
        console.log(`Found key in memory: ${key} => ${memValue}`);
        return memValue;
      }
      
      // Try hardcoded URLs next
      if (hardcodedUrls[key]) {
        console.log(`Found key in hardcoded URLs: ${key} => ${hardcodedUrls[key]}`);
        return hardcodedUrls[key];
      }
      
      // Try Redis last
      const client = await initRedis();
      if (client) {
        try {
          const redisValue = await client.get(key);
          console.log(`Redis lookup for ${key}: ${redisValue}`);
          if (redisValue) {
            // Cache in memory
            global.memoryStore.set(key, redisValue);
            return redisValue;
          }
        } catch (err) {
          console.error(`Redis get error for key ${key}:`, err);
        }
      }
      
      console.log(`Key not found anywhere: ${key}`);
      return undefined;
    } catch (error) {
      console.error(`Storage.get error for ${key}:`, error);
      return hardcodedUrls[key] || undefined;
    }
  },
  
  async set(key, value) {
    try {
      // Update hardcoded URLs (only for development)
      hardcodedUrls[key] = value;
      console.log(`Added to hardcoded URLs: ${key} => ${value}`);
      
      // Always set in memory
      global.memoryStore.set(key, value);
      console.log(`Added to memory: ${key} => ${value}`);

      // Try to set in Redis
      const client = await initRedis();
      if (client) {
        try {
          await client.set(key, value);
          console.log(`Added to Redis: ${key} => ${value}`);
        } catch (err) {
          console.error(`Redis set error for key ${key}:`, err);
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Storage.set error for ${key}:`, error);
      return false;
    }
  },
  
  async keys() {
    try {
      // Start with hardcoded URLs
      const allKeys = new Set(Object.keys(hardcodedUrls));
      
      // Add memory store keys
      for (const key of global.memoryStore.keys()) {
        allKeys.add(key);
      }
      
      // Add Redis keys if available
      const client = await initRedis();
      if (client) {
        try {
          const redisKeys = await client.keys('*');
          redisKeys.forEach(key => allKeys.add(key));
        } catch (err) {
          console.error('Error fetching Redis keys:', err);
        }
      }
      
      const keyArray = Array.from(allKeys);
      console.log(`Total keys found: ${keyArray.length}`);
      return keyArray;
    } catch (error) {
      console.error('Storage.keys error:', error);
      return Object.keys(hardcodedUrls);
    }
  },
  
  async dumpMemoryStore() {
    console.log('========== STORAGE DUMP ==========');
    console.log('Hardcoded URLs:');
    Object.entries(hardcodedUrls).forEach(([key, value]) => {
      console.log(`  ${key} => ${value}`);
    });
    
    console.log('Memory store:');
    global.memoryStore.forEach((value, key) => {
      console.log(`  ${key} => ${value}`);
    });
    
    // Print Redis keys if available
    const client = await initRedis();
    if (client) {
      try {
        const keys = await client.keys('*');
        console.log(`Redis keys (${keys.length}):`);
        for (const key of keys) {
          const value = await client.get(key);
          console.log(`  ${key} => ${value}`);
        }
      } catch (err) {
        console.error('Error dumping Redis keys:', err);
      }
    }
    
    console.log('================================');
    return {
      hardcoded: hardcodedUrls,
      memory: Array.from(global.memoryStore.entries())
    };
  }
};

// Initialize memory store with test data if empty
if (global.memoryStore.size === 0) {
  console.log('Initializing memory store with test data');
  global.memoryStore.set('test', 'https://example.com');
  storage.dumpMemoryStore();
}

module.exports = storage;

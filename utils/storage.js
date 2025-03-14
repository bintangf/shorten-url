// Fallback in-memory storage for local development
const memoryStore = new Map();

const storage = {
  async get(key) {
    try {
      // Simple in-memory implementation
      return memoryStore.get(key);
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },
  
  async set(key, value) {
    try {
      // Simple in-memory implementation
      memoryStore.set(key, value);
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },
  
  async keys(pattern) {
    try {
      // Simple in-memory implementation
      return Array.from(memoryStore.keys());
    } catch (error) {
      console.error('Storage keys error:', error);
      return [];
    }
  }
};

module.exports = storage;

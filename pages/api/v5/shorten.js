import storage from '../../../utils/storage'

export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
    const urls = body.urls.trim()
    const password = body.password
    const urlsArray = urls.split(/[\n,]+/)

    console.log(`Processing URLs: ${JSON.stringify(urlsArray)}`);
    
    // Debug: Dump memory store before processing
    await storage.dumpMemoryStore();

    const results = [];
    
    for (const url of urlsArray) {
      if (url === '') continue;

      // Generate a simple key
      let key = Math.random().toString(36).substring(2, 5) + Math.random().toString(36).substring(2, 5);
      
      // Check if key exists
      let keyExists = await storage.get(key);
      
      // Keep trying until we find an unused key
      while (keyExists) {
        key = Math.random().toString(36).substring(2, 5) + Math.random().toString(36).substring(2, 5);
        keyExists = await storage.get(key);
      }

      // Add password if specified
      if (password) {
        key = key + "$" + password;
      }

      console.log(`Storing URL: key=${key}, url=${url}`);
      
      // Store the URL
      await storage.set(key, url);
      
      // Verify storage
      const storedUrl = await storage.get(key);
      console.log(`Verification - retrieved ${key}: ${storedUrl}`);

      results.push({
        key: key.split("$")[0],
        url: url
      });
    }

    // Debug: Dump memory store after processing
    await storage.dumpMemoryStore();
    
    console.log(`Returning results: ${JSON.stringify(results)}`);
    res.status(200).json(results);
  } catch (error) {
    console.error('Shorten handler error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
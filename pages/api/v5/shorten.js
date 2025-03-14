import storage from '../../../utils/storage'

export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
    const urls = body.urls.trim()
    const password = body.password
    const urlsArray = urls.split(/[\n,]+/)

    const promises = urlsArray.map(async (url) => {
      if (url === '') return null

      let keys = Array.from({length: 10}, () => Math.random().toString(36).substring(2, 5) + Math.random().toString(36).substring(2, 5))
      let existingKeys = await Promise.all(keys.map(key => storage.get(key)))
      let key = keys.find((key, index) => !existingKeys[index])

      if (password !== "") {
        key = key + "$" + password
      }

      await storage.set(key, url)

      return {
        key: key.split("$")[0],
        url: url
      }
    })

    const results = await Promise.all(promises)

    res.status(200).json(results.filter(result => result !== null))
  } catch (error) {
    console.error('Shorten handler error:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
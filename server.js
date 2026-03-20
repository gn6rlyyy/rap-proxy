const express = require("express")
const app     = express()
const PORT    = process.env.PORT || 3000

// Cache the full Rolimons item list for 5 minutes
// Rolimons only allows 1 request per minute anyway, so we cache aggressively
let cache     = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes in ms

async function getRolimonsData() {
    const now = Date.now()
    if (cache && (now - cacheTime) < CACHE_TTL) {
        return cache
    }
    const response = await fetch("https://www.rolimons.com/itemapi/itemdetails", {
        headers: {
            // Rolimons requires a real user-agent or it may block
            "User-Agent": "Mozilla/5.0 (compatible; RAPProxy/1.0)"
        }
    })
    if (!response.ok) {
        throw new Error(`Rolimons returned ${response.status}`)
    }
    const data = await response.json()
    if (!data.success) {
        throw new Error("Rolimons reported success=false")
    }
    cache     = data.items
    cacheTime = now
    console.log(`[Proxy] Rolimons data refreshed. ${Object.keys(cache).length} items cached.`)
    return cache
}

// GET /rap/:assetId  — returns { assetId, rap, value }
app.get("/rap/:assetId", async (req, res) => {
    const { assetId } = req.params

    if (!/^\d+$/.test(assetId)) {
        return res.status(400).json({ error: "Invalid assetId" })
    }

    try {
        const items = await getRolimonsData()
        const item  = items[assetId]

        if (!item) {
            return res.status(404).json({
                assetId           : parseInt(assetId),
                recentAveragePrice: 0,
                value             : 0,
                error             : "Item not found in Rolimons database"
            })
        }

        // Rolimons format: [Name, Acronym, RAP, Value, DefaultValue, Demand, Trend, Projected, Hyped, Rare]
        const rap   = item[2] || 0
        const value = item[3] || 0

        res.json({
            assetId           : parseInt(assetId),
            name              : item[0],
            recentAveragePrice: rap,
            value             : value
        })

    } catch (err) {
        console.error("[Proxy] Error:", err.message)
        res.status(500).json({ error: err.message })
    }
})

// GET /items  — returns ALL limiteds (useful for building case pools later)
app.get("/items", async (req, res) => {
    try {
        const items = await getRolimonsData()
        res.json({ success: true, count: Object.keys(items).length, items })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Health check
app.get("/", (req, res) => {
    res.json({ status: "ok", cached: cache !== null, itemCount: cache ? Object.keys(cache).length : 0 })
})

app.listen(PORT, () => console.log(`RAP proxy running on port ${PORT}`))

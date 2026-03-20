const express = require("express")
const app = express()
const PORT = process.env.PORT || 3000

app.get("/rap/:assetId", async (req, res) => {
    const { assetId } = req.params
    if (!/^\d+$/.test(assetId)) {
        return res.status(400).json({ error: "Invalid assetId" })
    }
    try {
        const response = await fetch(
            `https://economy.roblox.com/v1/assets/${assetId}/resale-data`
        )
        const data = await response.json()
        res.json({
            assetId: parseInt(assetId),
            recentAveragePrice: data.recentAveragePrice || 0
        })
    } catch (err) {
        res.status(500).json({ error: "Failed" })
    }
})

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`))

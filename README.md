# Jeff Backend
Endpoints:
- POST /identify (multipart/form-data: image) → { seoTitle }
- POST /ebay-data (JSON: { title }) → { avgSoldPrice, soldCount, activeCount, sellThroughPct, maxBuyCost }

Setup:
1) cp .env.example .env and set EBAY_APP_ID. Configure Google Vision (GOOGLE_APPLICATION_CREDENTIALS) on host.
2) npm install
3) npm start

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { identifyFromImage } from './vision.js';
import { getEbayMetrics } from './ebay.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/identify', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const { buffer, mimetype } = req.file;
    const result = await identifyFromImage(buffer, mimetype);
    res.json({ seoTitle: result.seoTitle });
  } catch (err) {
    console.error('IDENTIFY ERROR', err);
    res.status(500).json({ error: 'Identify failed', details: String(err) });
  }
});

app.post('/ebay-data', async (req, res) => {
  try {
    const { title } = req.body || {};
    if (!title || typeof title !== 'string') return res.status(400).json({ error: 'Missing title' });
    const data = await getEbayMetrics(title);
    res.json(data);
  } catch (err) {
    console.error('EBAY ERROR', err);
    res.status(500).json({ error: 'eBay lookup failed', details: String(err) });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Jeff backend running on port', PORT));

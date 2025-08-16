const DISABLE_VISION = process.env.JEFF_DISABLE_VISION === 'true';

async function fallbackOCR(buffer) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  const { data: { text } } = await worker.recognize(buffer);
  await worker.terminate();
  return text || '';
}

function guessLabelsFromOCRText(text) {
  const out = [];
  const lower = text.toLowerCase();
  if (/(shorts|cargo)/.test(lower)) out.push('Men’s Camo Cargo Shorts');
  if (/(typewriter)/.test(lower)) out.push('Manual Portable Typewriter');
  if (/(hoodie|sweatshirt)/.test(lower)) out.push('Hoodie');
  if (/(jacket|coat)/.test(lower)) out.push('Jacket');
  return out;
}

function extractBrand(ocrText) {
  const lines = ocrText
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 15);
  const banned = /(machine wash|made in|cotton|polyester|spandex|washing|do not|china|bangladesh|vietnam|indonesia|rn\s*\d+)/i;
  for (const line of lines) {
    if (banned.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length <= 4) {
      const cleaned = line.replace(/[^\w\s\-\&]/g, '').trim();
      if (cleaned && /[A-Za-z]/.test(cleaned)) {
        return cleaned.replace(/\s+/g, ' ');
      }
    }
  }
  return '';
}

function extractSize(ocrText) {
  const m = ocrText.match(/(\b\d{2}[xX]\d{2}\b|\b(?:XS|S|M|L|XL|XXL|XXXL)\b|\b\d{2}\b)/);
  return m ? m[0].toUpperCase() : '';
}

function titleCase(str) {
  return str.trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
}

function buildTitle({ brand, model, labels, size }) {
  const parts = [];
  if (brand) parts.push(brand);
  if (model) parts.push(model);
  if (size) parts.push(size);
  if (labels && labels.length) parts.push(labels.join(' '));
  return titleCase(parts.join(' ').replace(/\s+/g, ' ')).trim();
}

export async function identifyFromImage(buffer, mimetype) {
  let ocrText = '';
  let labels = [];

  if (!DISABLE_VISION) {
    try {
      const vision = await import('@google-cloud/vision');
      const client = new vision.ImageAnnotatorClient();
      const [labelRes] = await client.labelDetection({ image: { content: buffer } });
      const [textRes]  = await client.textDetection({ image: { content: buffer } });
      labels = (labelRes?.labelAnnotations || []).slice(0, 5).map(x => x.description);
      ocrText = textRes?.fullTextAnnotation?.text || '';
    } catch (e) {
      console.warn('Google Vision unavailable, falling back to Tesseract OCR only.', e.message);
      ocrText = await fallbackOCR(buffer);
      labels = guessLabelsFromOCRText(ocrText);
    }
  } else {
    ocrText = await fallbackOCR(buffer);
    labels = guessLabelsFromOCRText(ocrText);
  }

  const noisy = /(machine wash|made in|cotton|polyester|spandex|wash|bleach|tumble dry|iron|rn\s*\d+)/ig;
  const cleaned = (ocrText || '').split(/\r?\n/).filter(l => !noisy.test(l)).join(' ');

  const brand = extractBrand(cleaned);
  const modelMatch = cleaned.match(/\b([A-Za-z]{2,}[\-\dA-Za-z]{0,8})\b/);
  const model = modelMatch ? modelMatch[1] : '';

  const size = extractSize(cleaned);
  const seoTitle = buildTitle({ brand, model, labels, size }) || 'Item';

  return { seoTitle };
}

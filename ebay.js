import axios from 'axios';

function fmtUSD(n) { return Math.round(n * 100) / 100; }
function datesForLast90Days() {
  const now = new Date();
  const to = now.toISOString().slice(0,19) + 'Z';
  const fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const from = fromDate.toISOString().slice(0,19) + 'Z';
  return { from, to };
}

export async function getEbayMetrics(title) {
  const APP_ID = process.env.EBAY_APP_ID;
  if (!APP_ID) throw new Error('Missing EBAY_APP_ID');

  const endpoint = 'https://svcs.ebay.com/services/search/FindingService/v1';

  const { from, to } = datesForLast90Days();
  const completedParams = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.13.0',
    'SECURITY-APPNAME': APP_ID,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': 'true',
    'keywords': title,
    'paginationInput.entriesPerPage': '100',
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'itemFilter(1).name': 'EndTimeFrom',
    'itemFilter(1).value': from,
    'itemFilter(2).name': 'EndTimeTo',
    'itemFilter(2).value': to
  });

  let soldCount = 0, soldPrices = [];
  try {
    const { data } = await axios.get(`${endpoint}?${completedParams.toString()}`, {
      headers: { 'X-EBAY-SOA-GLOBAL-ID': 'EBAY-US' }
    });
    const resp = data?.findCompletedItemsResponse?.[0];
    const items = resp?.searchResult?.[0]?.item || [];
    for (const it of items) {
      const state = it?.sellingStatus?.[0]?.sellingState?.[0];
      if (state && state.toLowerCase().includes('endedwithsales')) {
        soldCount += 1;
        const priceStr = it?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__;
        const price = priceStr ? parseFloat(priceStr) : NaN;
        if (!isNaN(price) && price > 0 && price < 5000) soldPrices.push(price);
      }
    }
  } catch (e) { console.warn('findCompletedItems error', e.message); }

  const avgSoldPrice = soldPrices.length ? (soldPrices.reduce((a,b)=>a+b,0) / soldPrices.length) : 0;

  const activeParams = new URLSearchParams({
    'OPERATION-NAME': 'findItemsByKeywords',
    'SERVICE-VERSION': '1.13.0',
    'SECURITY-APPNAME': APP_ID,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': 'true',
    'keywords': title,
    'paginationInput.entriesPerPage': '1'
  });

  let activeCount = 0;
  try {
    const { data } = await axios.get(`${endpoint}?${activeParams.toString()}`, {
      headers: { 'X-EBAY-SOA-GLOBAL-ID': 'EBAY-US' }
    });
    const resp = data?.findItemsByKeywordsResponse?.[0];
    const total = resp?.paginationOutput?.[0]?.totalEntries?.[0];
    activeCount = total ? parseInt(total, 10) : 0;
  } catch (e) { console.warn('findItemsByKeywords error', e.message); }

  const sellThrough = activeCount > 0 ? (soldCount / activeCount) * 100 : (soldCount > 0 ? 100 : 0);
  const maxBuyCost = (avgSoldPrice * 0.75) / 3;

  return {
    title,
    avgSoldPrice: fmtUSD(avgSoldPrice),
    soldCount,
    activeCount,
    sellThroughPct: Math.round(sellThrough * 10) / 10,
    maxBuyCost: fmtUSD(maxBuyCost)
  };
}

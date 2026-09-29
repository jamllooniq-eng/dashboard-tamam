import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pixelId: process.env.META_PIXEL_ID || '',
      // Public TikTok pixel code (empty = TikTok stays completely off). The access token is never sent.
      tiktokPixelId: (process.env.TIKTOK_PIXEL_ID || '').trim(),
      iqdToUsdRate: Number(process.env.IQD_TO_USD_RATE) || 1400,
    }),
  };
};

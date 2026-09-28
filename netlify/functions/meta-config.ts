import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pixelId: process.env.META_PIXEL_ID || '',
      iqdToUsdRate: Number(process.env.IQD_TO_USD_RATE) || 1400,
    }),
  };
};

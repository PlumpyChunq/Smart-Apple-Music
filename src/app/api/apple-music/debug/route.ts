// Debug endpoint to test Apple Music API responses
// This returns instructions for testing in browser console

import { NextResponse } from 'next/server';

export async function GET() {
  const testCode = `
// Run this in browser console after connecting Apple Music:
// This will test EVERY possible /v1/me endpoint to find which ones work

async function exploreAppleMusicAPI() {
  const music = window.MusicKit.getInstance();
  if (!music.isAuthorized) {
    console.log('Not authorized - connect Apple Music first');
    return;
  }

  // All possible /v1/me endpoints based on Apple's documentation
  const endpoints = [
    // History endpoints
    '/v1/me/history/heavy-rotation',
    '/v1/me/heavy-rotation',
    '/v1/me/history/recent',
    '/v1/me/history',

    // Recent endpoints
    '/v1/me/recent/played',
    '/v1/me/recent/played/tracks',
    '/v1/me/recent/played/stations',
    '/v1/me/recentPlayed',
    '/v1/me/recentPlayed/tracks',

    // Library endpoints
    '/v1/me/library/recently-added',
    '/v1/me/library/recentlyAdded',
    '/v1/me/library/artists',
    '/v1/me/library/albums',
    '/v1/me/library/songs',
    '/v1/me/library/playlists',

    // Recommendations
    '/v1/me/recommendations',

    // Ratings
    '/v1/me/ratings/albums',
    '/v1/me/ratings/songs',

    // Storefront
    '/v1/me/storefront',
  ];

  const results = { working: [], failed: [] };

  console.log('Testing ' + endpoints.length + ' Apple Music API endpoints...\\n');

  for (const endpoint of endpoints) {
    try {
      const response = await music.api.music(endpoint, { limit: 5 });
      const data = response.data?.data || response.data;
      const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
      console.log('✅ ' + endpoint + ' - ' + count + ' items');
      results.working.push({ endpoint, count, sample: data?.[0] });
    } catch (e) {
      const status = e.message?.match(/\\d{3}/)?.[0] || 'error';
      console.log('❌ ' + endpoint + ' - ' + status);
      results.failed.push({ endpoint, error: e.message });
    }
  }

  console.log('\\n=== SUMMARY ===');
  console.log('Working endpoints: ' + results.working.length);
  console.log('Failed endpoints: ' + results.failed.length);

  console.log('\\n=== WORKING ENDPOINTS WITH DATA ===');
  results.working.filter(r => r.count > 0).forEach(r => {
    console.log(r.endpoint + ': ' + r.count + ' items');
    if (r.sample?.attributes) {
      const attrs = r.sample.attributes;
      console.log('  Sample: ' + (attrs.name || attrs.artistName || JSON.stringify(attrs).slice(0, 100)));
    }
  });

  console.log('\\n=== FULL RESULTS OBJECT ===');
  console.log(results);

  return results;
}

exploreAppleMusicAPI();
`;

  return NextResponse.json({
    message: 'Copy the code below and paste in browser console at interchord.stonefrog.com (after connecting Apple Music)',
    code: testCode
  }, { status: 200 });
}

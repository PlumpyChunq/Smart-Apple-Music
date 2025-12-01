import { NextResponse } from 'next/server';
import { SignJWT, importPKCS8 } from 'jose';

const TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID;
const KEY_ID = process.env.APPLE_MUSIC_KEY_ID;
const PRIVATE_KEY = process.env.APPLE_MUSIC_PRIVATE_KEY;

// Cache the token in memory to avoid regenerating on every request
let cachedToken: { token: string; expiresAt: number } | null = null;

async function generateDeveloperToken(): Promise<string> {
  if (!TEAM_ID || !KEY_ID || !PRIVATE_KEY) {
    throw new Error('Apple Music credentials not configured');
  }

  // Check if we have a valid cached token (with 5 minute buffer)
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 300) {
    return cachedToken.token;
  }

  // Token expires in 180 days (max allowed by Apple)
  const expiresAt = now + 180 * 24 * 60 * 60;

  // Import the private key
  const privateKey = await importPKCS8(
    PRIVATE_KEY.replace(/\\n/g, '\n'),
    'ES256'
  );

  // Generate the JWT
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
    .setIssuer(TEAM_ID)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(privateKey);

  // Cache the token
  cachedToken = { token, expiresAt };

  return token;
}

export async function GET() {
  try {
    const token = await generateDeveloperToken();

    return NextResponse.json(
      { token },
      {
        headers: {
          // Cache for 1 day on client, but we manage server-side caching ourselves
          'Cache-Control': 'public, max-age=86400',
        },
      }
    );
  } catch (error) {
    console.error('Error generating Apple Music developer token:', error);

    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json(
        { error: 'Apple Music credentials not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate developer token' },
      { status: 500 }
    );
  }
}

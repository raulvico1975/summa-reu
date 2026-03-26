/**
 * Dropbox API client per server-side (Next.js API routes)
 *
 * Wrapper HTTP minimal sense SDK.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DropboxTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface DropboxFileMetadata {
  name: string;
  path_lower: string;
  path_display: string;
  id: string;
  size?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Get Access Token from Refresh Token
// ─────────────────────────────────────────────────────────────────────────────

export async function getAccessToken(refreshToken: string): Promise<string> {
  const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
  const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;

  if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET) {
    throw new Error('Dropbox credentials not configured');
  }

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[dropbox-api] Token refresh failed:', errorText);
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data: DropboxTokenResponse = await response.json();
  return data.access_token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Folder
// ─────────────────────────────────────────────────────────────────────────────

export async function createFolder(accessToken: string, path: string): Promise<void> {
  const response = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path,
      autorename: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Ignorar error si la carpeta ja existeix
    if (errorText.includes('path/conflict/folder')) {
      return;
    }

    console.error(`[dropbox-api] Create folder failed for ${path}:`, errorText);
    throw new Error(`Create folder failed: ${response.status}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload File
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadFile(
  accessToken: string,
  path: string,
  content: Uint8Array
): Promise<{ path: string; size: number }> {
  const dropboxArg = {
    path,
    mode: 'overwrite',
    autorename: false,
    mute: true,
  };

  const body = content.buffer.slice(
    content.byteOffset,
    content.byteOffset + content.byteLength
  ) as ArrayBuffer;

  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify(dropboxArg),
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[dropbox-api] Upload failed for ${path}:`, errorText);
    throw new Error(`Upload failed: ${response.status}`);
  }

  const metadata: DropboxFileMetadata = await response.json();
  return {
    path: metadata.path_display || path,
    size: content.length,
  };
}

import { networkFetch } from './client.js';

export interface AuthHeaders {
  Authorization: string;
}

/**
 * Resolves the authentication headers for publishing graphs.
 * Primary: GitHub Actions OIDC token.
 * Fallback: STEM_PUBLISH_KEY environment variable.
 */
export async function resolveAuthHeaders(): Promise<{ success: true; headers: AuthHeaders } | { success: false; error: string }> {
  const oidcUrl = process.env['ACTIONS_ID_TOKEN_REQUEST_URL'];
  const oidcToken = process.env['ACTIONS_ID_TOKEN_REQUEST_TOKEN'];

  if (oidcUrl && oidcToken) {
    // We are in GitHub Actions and OIDC is available
    // Audience is optional but standard is to provide it. We'll fetch without audience to get the default,
    let url: URL;
    try {
      url = new URL(oidcUrl);
    } catch {
      return { success: false, error: 'Malformed OIDC Request URL' };
    }
    // Add audience if we wanted to: url.searchParams.append('audience', 'stem');
    
    const result = await networkFetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${oidcToken}`,
        Accept: 'application/json'
      }
    });

    if (result.success && result.data) {
      try {
        const json: unknown = JSON.parse(result.data);
        if (json !== null && typeof json === 'object' && 'value' in json) {
          const value = (json as { value?: unknown }).value;
          if (typeof value === 'string') {
            return { success: true, headers: { Authorization: `Bearer ${value}` } };
          }
        }
        return { success: false, error: 'OIDC response missing value field or is not a string' };
      } catch {
        return { success: false, error: 'Failed to parse OIDC response' };
      }
    }
    return { success: false, error: `Failed to fetch OIDC token: ${result.status} ${result.error || ''}` };
  }

  // Fallback
  const publishKey = process.env['STEM_PUBLISH_KEY'];
  if (publishKey) {
    return { success: true, headers: { Authorization: `Bearer ${publishKey}` } };
  }

  return { 
    success: false, 
    error: 'No authentication credentials found. Configure GitHub Actions OIDC or set STEM_PUBLISH_KEY environment variable.' 
  };
}

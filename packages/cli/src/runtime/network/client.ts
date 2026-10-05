export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface FetchResult {
  success: boolean;
  status?: number;
  data?: string;
  error?: string;
}

export async function networkFetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 10000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      ...(options.body !== undefined ? { body: options.body } : {}),
      signal: controller.signal
    });

    const data = await response.text();

    return {
      success: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeoutId);
  }
}

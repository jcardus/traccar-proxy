const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-fleet-session',
  'Access-Control-Expose-Headers': 'x-fleet-session',
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    const url = new URL(request.url);
    url.host = env.TRACCAR_WEB_HOST;
    url.protocol = 'http:';

    // Build headers
    const headers = new Headers(request.headers);

    // Get session from header or query string (for WebSocket)
    const sessionId = headers.get('x-fleet-session') || url.searchParams.get('session');
    if (sessionId) {
      headers.set('Cookie', `JSESSIONID=${sessionId}`);
      url.searchParams.delete('session'); // Don't forward the session param
    }

    // Handle WebSocket upgrade
    const isWebSocket = request.headers.get('Upgrade') === 'websocket';
    if (isWebSocket) {
      return fetch(url, {
        headers,
      });
    }

    // Make the request to Traccar
    const upstreamResponse = await fetch(url, {
      method: request.method,
      headers,
      body: request.body,
    });

    // Build response headers
    const responseHeaders = new Headers(upstreamResponse.headers);

    // Add CORS headers
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      responseHeaders.set(key, value);
    }

    // Extract JSESSIONID from Set-Cookie and expose via x-fleet-session
    const setCookie = upstreamResponse.headers.get('Set-Cookie');
    if (setCookie) {
      const match = setCookie.match(/JSESSIONID=([^;]+)/);
      if (match) {
        responseHeaders.set('x-fleet-session', match[1]);
      }
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};

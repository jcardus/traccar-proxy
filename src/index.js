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
    url.host = env.TRACCAR_WEB_HOST || 'gps.frotaweb.com';
    url.protocol = 'http:';

    // Build headers, converting x-fleet-session to Cookie
    const headers = new Headers(request.headers);
    const sessionId = headers.get('x-fleet-session');
    if (sessionId) {
      headers.set('Cookie', `JSESSIONID=${sessionId}`);
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

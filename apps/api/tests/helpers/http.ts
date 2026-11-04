export function cookieHeader(
  headers: Headers,
  name: string,
): string | undefined {
  const setCookie = headers.get("set-cookie");
  if (!setCookie) return undefined;

  // Hono serializes Set-Cookie as a single header on Node/Bun response objects;
  // headers.get() keeps the first value. Find the cookie by name.
  const start = setCookie.indexOf(`${name}=`);
  if (start === -1) return undefined;
  const end = setCookie.indexOf(";", start);
  return setCookie.slice(start, end === -1 ? undefined : end);
}
// Who is calling: client IP and User-Agent, used for rate limiting, session records and the
// audit log. The IP comes from proxy headers, which a client can forge unless the app runs
// behind a proxy that overwrites them (Vercel, Cloudflare, nginx do). So it is fine for rate
// limiting and logging, but never use it as proof of identity.

const MAX_USER_AGENT_LENGTH = 512;

export type RequestContext = {
  ip: string;
  userAgent: string;
};

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

export function getUserAgent(request: Request): string {
  const userAgent = request.headers.get("user-agent")?.trim();
  return userAgent ? userAgent.slice(0, MAX_USER_AGENT_LENGTH) : "unknown";
}

export function getRequestContext(request: Request): RequestContext {
  return { ip: getClientIp(request), userAgent: getUserAgent(request) };
}

// True when two User-Agents look like the same browser on the same OS. Version numbers are
// ignored so a browser auto-update doesn't log the user out; a different browser or OS
// doesn't match. "unknown" on either side is treated as a match (nothing to compare).
export function isSameUserAgentFamily(stored: string, current: string): boolean {
  if (stored === "unknown" || current === "unknown") return true;
  const normalize = (value: string): string => value.replace(/\d+/g, "").toLowerCase();
  return normalize(stored) === normalize(current);
}

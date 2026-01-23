import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Handle CORS for API routes
  if (request.nextUrl.pathname.startsWith("/api/v1")) {
    // Get origin from request
    const origin = request.headers.get("origin") || "";

    // Allowed origins
    const allowedOrigins = [
      "http://localhost:3001",
      "http://localhost:3000",
      process.env.CORS_ORIGIN,
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean);

    // Check if origin is allowed or if it's a Chrome extension
    const isAllowed =
      allowedOrigins.includes(origin) ||
      origin.startsWith("chrome-extension://");

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": isAllowed ? origin : "null",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Add CORS headers to response
    const response = NextResponse.next();
    
    if (isAllowed) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/v1/:path*",
};

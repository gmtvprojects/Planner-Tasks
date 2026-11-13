import { NextRequest, NextResponse } from "next/server";

// Checagem otimista (só presença do cookie); a validação real fica no DAL.
export default function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/dashboard") && !req.cookies.has("session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };

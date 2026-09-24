import { NextRequest, NextResponse } from "next/server";

const API = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstreamUrl = `${API}/${path.join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const init: RequestInit = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.text();
  const upstream = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers();
  const type = upstream.headers.get("content-type");
  if (type) responseHeaders.set("content-type", type);
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) responseHeaders.set("content-disposition", disposition);
  const response = new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  for (const cookieValue of upstream.headers.getSetCookie()) response.headers.append("set-cookie", cookieValue);
  return response;
}

export const GET = proxy;
export const POST = proxy;

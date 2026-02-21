import { NextResponse } from "next/server";
import { UnauthorizedError, ForbiddenError } from "./auth";

export function errorToResponse(err: unknown) {
  if (err instanceof UnauthorizedError) return new NextResponse("Unauthorized", { status: 401 });
  if (err instanceof ForbiddenError) return new NextResponse("Forbidden", { status: 403 });
  if (err instanceof Error) return new NextResponse(err.message, { status: 500 });
  return new NextResponse("Server error", { status: 500 });
}

import { supabaseAdmin } from "./supabase-admin";

export class UnauthorizedError extends Error {
  status = 401 as const;
  constructor() { super("Unauthorized"); }
}
export class ForbiddenError extends Error {
  status = 403 as const;
  constructor() { super("Forbidden"); }
}

export async function requireUserId(req: Request): Promise<string> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new UnauthorizedError();

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) throw new UnauthorizedError();
  return data.user.id;
}

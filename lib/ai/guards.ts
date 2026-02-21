import { z } from "zod";

export const ChatOutSchema = z.object({
  headline: z.string().min(2).max(80),
  happening: z.string().min(2).max(120),
  doThis: z.string().min(10).max(900),
  avoid: z.string().min(2).max(200),
  sayThis: z.string().min(2).max(200),
});

export type ChatOut = z.infer<typeof ChatOutSchema>;

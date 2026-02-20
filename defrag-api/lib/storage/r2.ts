import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

export function r2Client() {
  return new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadPngToR2(args: {
  key: string; // e.g. "stills/<hash>.png"
  body: Buffer;
  cacheSeconds?: number; // CDN cache
}) {
  const s3 = r2Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: args.key,
      Body: args.body,
      ContentType: "image/png",
      CacheControl: `public, max-age=${args.cacheSeconds ?? 31536000}, immutable`,
    })
  );

  const publicUrl = `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${args.key}`;
  return { publicUrl };
}

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Blobs } from '@jarvis-os/core';
import type { Settings } from './settings';

/**
 * The core's `Blobs` port over Neon Object Storage, which speaks S3 (decision 0002). Another
 * S3-compatible store replaces it by its settings alone.
 */
export function objectStorage(settings: Settings['storage']): Blobs {
  const s3 = new S3Client({
    region: settings.region,
    endpoint: settings.endpoint,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  const bucket = settings.bucket;
  return {
    async put(key, bytes, mediaType) {
      await s3.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: mediaType }),
      );
    },
    async get(key) {
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!object.Body) throw new Error(`No stored file ${key}.`);
      return object.Body.transformToByteArray();
    },
    link(key, seconds) {
      return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: seconds,
      });
    },
  };
}

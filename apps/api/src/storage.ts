import { quiet } from './settings';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
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
    // A quiet copy (next) shares the real storage to read the files it was cloned with; what it
    // keeps goes under its own folder (v3 D19).
    prefix: quiet() ? 'next/' : '',
    async put(key, bytes, mediaType) {
      await s3.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: mediaType }),
      );
    },
    // A large file in parts (v3 médias): each part goes straight to storage, never kept here.
    async startUpload(key, mediaType) {
      const made = await s3.send(
        new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: mediaType }),
      );
      if (!made.UploadId) throw new Error('The storage did not start the upload.');
      return made.UploadId;
    },
    async uploadPart(key, uploadId, n, bytes) {
      const part = await s3.send(
        new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: n,
          Body: bytes,
        }),
      );
      if (!part.ETag) throw new Error(`The storage did not keep part ${n}.`);
      return part.ETag;
    },
    async finishUpload(key, uploadId, parts) {
      await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: [...parts]
              .sort((a, b) => a.n - b.n)
              .map((one) => ({ PartNumber: one.n, ETag: one.etag })),
          },
        }),
      );
    },
    async abortUpload(key, uploadId) {
      await s3.send(
        new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }),
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
    async remove(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

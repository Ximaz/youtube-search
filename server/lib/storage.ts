import { Buffer } from 'node:buffer'
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { useEnv } from './env'

// Parses the app-defined STORAGE_URL convention:
//   s3://<accessKey>:<secretKey>@<host>:<port>/<bucket>?region=<r>[&tls=true]
// Path-style is INFERRED (custom endpoint ⇒ on, real AWS ⇒ virtual-hosted) so
// the same config works on SeaweedFS, MinIO, and AWS with no extra knob. Use
// the s3s:// scheme (or ?tls=true) for TLS against a custom endpoint.
function parseStorageUrl(raw: string) {
  const url = new URL(raw)
  const isAws = /(^|\.)amazonaws\.com$/i.test(url.hostname)
  const secure = isAws || url.protocol === 's3s:' || url.searchParams.get('tls') === 'true'
  const bucket = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!bucket) throw new Error('STORAGE_URL must include a bucket path, e.g. s3://key:secret@host:8333/my-bucket')

  return {
    endpoint: `${secure ? 'https' : 'http'}://${url.host}`,
    region: url.searchParams.get('region') ?? 'us-east-1',
    accessKeyId: decodeURIComponent(url.username),
    secretAccessKey: decodeURIComponent(url.password),
    bucket,
    forcePathStyle: !isAws,
  }
}

export interface Storage {
  client: S3Client
  bucket: string
}

function createStorage(): Storage {
  const cfg = parseStorageUrl(useEnv().STORAGE_URL)
  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    forcePathStyle: cfg.forcePathStyle,
  })
  return { client, bucket: cfg.bucket }
}

let cached: Storage | null = null

export function useStorage(): Storage {
  if (!cached) cached = createStorage()
  return cached
}

// HeadBucket → CreateBucket if absent. Retries through storage warmup since the
// storage service starts (but isn't healthchecked) before the app.
export async function ensureBucket(attempts = 20, delayMs = 1500): Promise<void> {
  const { client, bucket } = useStorage()
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }))
      return // already exists
    }
    catch (error) {
      const meta = error as { $metadata?: { httpStatusCode?: number }, name?: string }
      const missing = meta.$metadata?.httpStatusCode === 404
        || meta.name === 'NotFound'
        || meta.name === 'NoSuchBucket'
      if (missing) {
        try {
          await client.send(new CreateBucketCommand({ Bucket: bucket }))
          return
        }
        catch (createError) {
          lastError = createError
        }
      }
      else {
        // Connection/other error — storage is probably still warming up.
        lastError = error
      }
      await new Promise(resolveDelay => setTimeout(resolveDelay, delayMs))
    }
  }
  throw new Error(`Could not ensure storage bucket "${bucket}": ${String(lastError)}`)
}

// Lightweight reachability probe for the health check.
export async function storageReachable(): Promise<boolean> {
  try {
    const { client, bucket } = useStorage()
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
    return true
  }
  catch {
    return false
  }
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const { client, bucket } = useStorage()
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }))
}

export async function getObjectBytes(key: string): Promise<{ body: Buffer, contentType?: string }> {
  const { client, bucket } = useStorage()
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const bytes = await res.Body!.transformToByteArray()
  return { body: Buffer.from(bytes), contentType: res.ContentType }
}

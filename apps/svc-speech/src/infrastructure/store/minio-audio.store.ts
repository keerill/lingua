import { createHash } from 'node:crypto';
import { Client as MinioClient } from 'minio';
import { AudioStore, StoredAudio } from '../../domain/ports/audio.store';

export class MinioAudioStore implements AudioStore {
  private readonly client: MinioClient;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT ?? 'localhost:9000';
    const [host, portStr] = endpoint.split(':');
    this.bucket = process.env.MINIO_BUCKET ?? 'lingua-audio';
    this.publicUrl = (
      process.env.MINIO_PUBLIC_URL ?? 'http://localhost:9000'
    ).replace(/\/+$/, '');
    this.client = new MinioClient({
      endPoint: host,
      port: Number(portStr ?? 9000),
      useSSL: (process.env.MINIO_SECURE ?? 'false').toLowerCase() === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    });
  }

  async putWav(data: Buffer, keyHint = 'tts'): Promise<StoredAudio> {
    const digest = createHash('sha1').update(data).digest('hex').slice(0, 16);
    const objectKey = `${keyHint}/${digest}.wav`;
    if (!(await this.client.bucketExists(this.bucket))) {
      await this.client.makeBucket(this.bucket);
    }
    await this.client.putObject(this.bucket, objectKey, data, data.length, {
      'Content-Type': 'audio/wav',
    });
    return { objectKey, url: `${this.publicUrl}/${this.bucket}/${objectKey}` };
  }
}

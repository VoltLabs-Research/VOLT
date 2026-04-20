import zlib from 'node:zlib';

export const deflateJsonToBase64Gzip = (value: unknown): string =>
    zlib.gzipSync(Buffer.from(JSON.stringify(value), 'utf8')).toString('base64');

export const inflateBase64GzipJson = <T>(value: string): T =>
    JSON.parse(zlib.gunzipSync(Buffer.from(value, 'base64')).toString('utf8')) as T;

import zlib from 'node:zlib';

export const inflateBase64GzipJson = <T>(value: string): T =>
    JSON.parse(zlib.gunzipSync(Buffer.from(value, 'base64')).toString('utf8')) as T;

export const deflateJsonToBase64Gzip = (value: string): string =>
    zlib.gzipSync(value).toString('base64');

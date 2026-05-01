import zlib from 'node:zlib';

const gzipAsync = (value: string): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        zlib.gzip(value, (error, result) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(result);
        });
    });

const gunzipAsync = (value: Buffer): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        zlib.gunzip(value, (error, result) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(result);
        });
    });

export const inflateBase64GzipJson = async <T>(value: string): Promise<T> => {
    const inflated = await gunzipAsync(Buffer.from(value, 'base64'));
    return JSON.parse(inflated.toString('utf8')) as T;
};

export const deflateJsonToBase64Gzip = async (value: string): Promise<string> => {
    const compressed = await gzipAsync(value);
    return compressed.toString('base64');
};

const collect = async (stream: AsyncIterable<unknown>): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream){
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
};

export const buffer = collect;

export const text = async (stream: AsyncIterable<unknown>): Promise<string> => (await collect(stream)).toString('utf8');

export const json = async (stream: AsyncIterable<unknown>): Promise<unknown> => JSON.parse(await text(stream));

export const arrayBuffer = async (stream: AsyncIterable<unknown>): Promise<ArrayBuffer> => {
    return new Uint8Array(await collect(stream)).buffer;
};

export const blob = async (stream: AsyncIterable<unknown>): Promise<Blob> => new Blob([new Uint8Array(await collect(stream))]);

export default { buffer, text, json, arrayBuffer, blob };

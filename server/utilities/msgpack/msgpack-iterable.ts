import { decodeMultiStreamFromFile } from '@/utilities/msgpack/msgpack-stream';

export interface DecodeArrayStreamOptions{
    iterableKey?: string;
    chunkSize?: number;
};

export async function *decodeArrayStreamFromFile<T = unknown>(
    filePath: string,
    options: DecodeArrayStreamOptions = {}
): AsyncIterable<T[]>{
    const { iterableKey, chunkSize } = options;

    for await(const msg of decodeMultiStreamFromFile(filePath)){
        const m = msg as any;

        let arr: unknown;
        if(iterableKey){
            if(!m || typeof m !== 'object') continue;
            arr = (m as any)[iterableKey];
        }else{
            arr = m;
        }

        if(!Array.isArray(arr) || arr.length === 0){
            continue;
        }

        if(!chunkSize || chunkSize <= 0 || arr.length <= chunkSize){
            yield arr as T[];
            continue;
        }

        for(let i = 0; i < arr.length; i += chunkSize){
            const slice = arr.slice(i, i + chunkSize);
            if(slice.length > 0){
                yield slice as T[];
            }
        }
    }
}

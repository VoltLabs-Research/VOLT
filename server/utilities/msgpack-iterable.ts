import { decodeMultiStream } from '@msgpack/msgpack';
import type { Readable } from 'node:stream';
import * as fs from 'node:fs';

export interface DecodeArrayStreamOptions{
    iterableKey?: string;
    chunkSize?: number;
};

export async function *decodeArrayStream(
    input: Readable,
    options: DecodeArrayStreamOptions = {}
): AsyncIterable<any[]>{
    const { iterableKey, chunkSize = 10_000 } = options;
    const msgStream = decodeMultiStream(input);
    let batch: any[] = [];
    
    const flush = () => {
        if(batch.length === 0) return null;
        const out = batch;
        batch = []
        return out;
    };

    for await(const msg of msgStream){
        if(Array.isArray(msg)){
            for(const item of msg){
                batch.push(item);
                if(batch.length >= chunkSize){
                    const out = flush();
                    if(out) yield out;
                }
            }

            continue;
        }

        if(iterableKey && msg && typeof msg === 'object'){
            const arr = (msg as any)[iterableKey];
            if(Array.isArray(arr)){
                for(const item of arr){
                    batch.push(item);
                    if(batch.length >= chunkSize){
                        const out = flush();
                        if(out) yield out;
                    }
                }
                continue;
            }
        }

        batch.push(msg);
        if(batch.length >= chunkSize){
            const out = flush();
            if(out) yield out;
        }
    }

    const last = flush();
    if(last) yield last;
}

export async function *decodeArrayStreamFromFile(
    filePath: string,
    options: DecodeArrayStreamOptions = {}
): AsyncIterable<any[]>{
    const stream = fs.createReadStream(filePath);
    try{
        for await(const slice of decodeArrayStream(stream, options)){
            yield slice;
        }
    }finally{
        stream.close();
    }
}
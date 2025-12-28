import { decode, Decoder } from '@msgpack/msgpack';

const mergeChunkedValue = (target: any, incoming: any): any => {
    if(incoming === undefined || incoming === null) return target;
    if(target === undefined || target === null) return incoming;

    if(Array.isArray(target) && Array.isArray(incoming)){
        target.push(...incoming);
        return target;
    }

    if(target && incoming && typeof target === 'object' && typeof incoming === 'object'){
        for(const [key, value] of Object.entries(incoming)){
            const existing = (target as any)[key];
            if(Array.isArray(existing) && Array.isArray(value)){
                existing.push(...value);
            }else if(existing && value && typeof existing === 'object' && typeof value === 'object'){
                (target as any)[key] = mergeChunkedValue(existing, value);
            }else{
                (target as any)[key] = value;
            }
        }
        return target;
    }

    return incoming;
};

export const decodeMsgpackBuffer = async (buffer: ArrayBuffer): Promise<any> => {
    const view = new Uint8Array(buffer);
    try{
        return decode(view);
    }catch(err: any){
        if(!(err instanceof RangeError) || !/Extra \d+ of \d+ byte\(s\) found/.test(err.message)){
            throw err;
        }
    }

    const decoder = new Decoder();
    const src = (async function*(){
        yield view;
    })();

    let result: any = null;
    for await (const value of decoder.decodeStream(src)){
        result = mergeChunkedValue(result, value);
    }
    return result;
};

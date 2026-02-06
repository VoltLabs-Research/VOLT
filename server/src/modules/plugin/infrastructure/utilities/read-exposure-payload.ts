import { decodeMultiStreamFromFile } from '@shared/infrastructure/utilities/msgpack';
import mergeChunkedValue from './merge-chunked-value';
import getNestedValue from '@shared/infrastructure/utilities/get-nested-value';

interface PayloadResult{
    data: any;
    metadata: Record<string, any> | null;
    count: number;
};

const removeArrays = <T>(value: T): T => {
    if(Array.isArray(value)){
        return null as unknown as T;
    }

    if(value && typeof value === 'object'){
        const out: any = {};
        for(const [k, v] of Object.entries(value as any)){
            if(Array.isArray(v)) continue;
            out[k] = removeArrays(v);
            if(out[k] === null) delete out[k];
        }
        return out;
    }

    return value;
}

/**
 * Reads a msgpack file stream and aggregates data/metadata based on requirements.
 */
const readExposurePayload = async (
    filePath: string,
    iterableKey: string | undefined,
    options: {
        needsData: boolean;
        needsMetadata: boolean
    }
): Promise<PayloadResult> => {
    let data: any = null;
    let metadata: Record<string, any> | null = null;
    let count = 0;

    for await(const message of decodeMultiStreamFromFile(filePath)){
        // Extract metadata
        if(options.needsMetadata){
            const chunkMeta = removeArrays(message);
            if(chunkMeta && typeof chunkMeta === 'object'){
                metadata = mergeChunkedValue(metadata, chunkMeta);
            }
        }

        // Extract data
        const chunkData = iterableKey ? getNestedValue(message, iterableKey) : message;
        if(options.needsData){
            data = mergeChunkedValue(data, chunkData);
        }

        // Count items
        if(Array.isArray(chunkData)) count += chunkData.length;
        else if(chunkData !== null) count = Math.max(count, 1);
    }

    if(options.needsData && Array.isArray(data)){
        count = data.length;
    }

    return { data, metadata, count };
};

export default readExposurePayload;
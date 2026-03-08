import mergeChunkedValue from './merge-chunked-value';

import { decodeMultiStreamFromFile } from '@shared/infrastructure/utilities/msgpack';
import getNestedValue from '@shared/infrastructure/utilities/get-nested-value';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

interface PayloadResult{
    data: unknown;
    metadata: Record<string, unknown> | null;
    count: number;
};

interface ReadExposurePayloadOptions {
    needsData: boolean;
    needsMetadata: boolean;
};

const removeArrays = (value: unknown): unknown => {
    if(Array.isArray(value)){
        return null;
    }

    if(isRecord(value)){
        const output: Record<string, unknown> = {};
        for(const [key, nestedValue] of Object.entries(value)){
            if(Array.isArray(nestedValue)) continue;

            const normalizedValue = removeArrays(nestedValue);
            if(normalizedValue === null) continue;

            output[key] = normalizedValue;
        }

        return output;
    }

    return value;
};

/**
 * Reads a msgpack file stream and aggregates data/metadata based on requirements.
 */
const readExposurePayload = async (
    filePath: string,
    iterableKey: string | undefined,
    options: ReadExposurePayloadOptions
): Promise<PayloadResult> => {
    let data: unknown = null;
    let metadata: Record<string, unknown> | null = null;
    let count = 0;

    for await(const message of decodeMultiStreamFromFile(filePath)){
        if(options.needsMetadata){
            const chunkMeta = removeArrays(message);
            if(isRecord(chunkMeta)){
                const mergedMetadata = mergeChunkedValue(metadata, chunkMeta);
                if(isRecord(mergedMetadata)){
                    metadata = mergedMetadata;
                }
            }
        }

        const chunkData = iterableKey ? getNestedValue(message, iterableKey) : message;
        if(options.needsData){
            data = mergeChunkedValue(data, chunkData);
        }

        if(Array.isArray(chunkData)) count += chunkData.length;
        else if(chunkData !== null) count = Math.max(count, 1);
    }

    if(options.needsData && Array.isArray(data)){
        count = data.length;
    }

    return { data, metadata, count };
};

export default readExposurePayload;

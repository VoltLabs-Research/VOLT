import { isRecord } from '@shared/infrastructure/utilities/type-guards';

/**
 * Merges partial data chunks (arrays or objects) into a single structure.
 */
const mergeChunkedValue = (target: unknown, incoming: unknown): unknown => {
    if(incoming === null) return target;
    if(target === null) return incoming;

    if(Array.isArray(target) && Array.isArray(incoming)){
        target.push(...incoming);
        return target;
    }

    if(isRecord(target) && isRecord(incoming)){
        for(const [key, incomingValue] of Object.entries(incoming)){
            const targetValue = target[key];

            if(Array.isArray(targetValue) && Array.isArray(incomingValue)){
                targetValue.push(...incomingValue);
            }else if(isRecord(targetValue) && isRecord(incomingValue)){
                target[key] = mergeChunkedValue(targetValue, incomingValue);
            }else{
                target[key] = incomingValue;
            }
        }

        return target;
    }

    return incoming;
};

export default mergeChunkedValue;

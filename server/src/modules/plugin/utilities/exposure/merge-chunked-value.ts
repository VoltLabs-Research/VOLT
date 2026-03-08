/**
 * Merges partial data chunks (arrays or objects) into a single structure.
 */
const mergeChunkedValue = (target: any, incoming: any): any => {
    if(incoming === null) return target;
    if(target === null) return incoming;

    if(Array.isArray(target) && Array.isArray(incoming)){
        target.push(...incoming);
        return target;
    }

    if(typeof target === 'object' && typeof incoming === 'object'){
        for(const key in incoming){
            const targetValue = target[key];
            const incomingValue = incoming[key];

            if(Array.isArray(targetValue) && Array.isArray(incomingValue)){
                targetValue.push(...incomingValue);
            }else if(typeof targetValue === 'object' && typeof incomingValue === 'object'){
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
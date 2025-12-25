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

export default removeArrays;
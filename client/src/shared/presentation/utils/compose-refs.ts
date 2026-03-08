import React from 'react';

const setRef = <T,>(ref: React.Ref<T> | undefined, value: T | null) => {
    if (typeof ref === 'function') {
        ref(value);
        return;
    }

    if (ref && typeof ref === 'object') {
        const mutableRef = ref as React.MutableRefObject<T | null>;
        mutableRef.current = value;
    }
};

const composeRefs = <T,>(...refs: Array<React.Ref<T> | undefined>) => {
    return (node: T | null) => {
        refs.forEach((ref) => {
            setRef(ref, node);
        });
    };
};

export default composeRefs;

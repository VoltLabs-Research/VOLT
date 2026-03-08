import React from 'react';

const setRef = <T,>(ref: React.Ref<T> | undefined, value: T | null) => {
    if (typeof ref === 'function') {
        ref(value);
        return;
    }

    if (ref && typeof ref === 'object') {
        Object.assign(ref, { current: value });
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

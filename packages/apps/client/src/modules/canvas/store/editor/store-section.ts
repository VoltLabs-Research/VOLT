type Key = string | number | symbol;

export const mergeSectionState = <TRoot extends object, TSectionKey extends keyof TRoot>(
    state: TRoot,
    sectionKey: TSectionKey,
    partial: Partial<TRoot[TSectionKey]>
): Pick<TRoot, TSectionKey> => ({
    [sectionKey]: {
        ...(state[sectionKey] as object),
        ...(partial as object)
    } as TRoot[TSectionKey]
} as Pick<TRoot, TSectionKey>);

export const mergeNestedSectionState = <
    TRoot extends object,
    TSectionKey extends keyof TRoot,
    TNestedKey extends keyof TRoot[TSectionKey]
>(
    state: TRoot,
    sectionKey: TSectionKey,
    nestedKey: TNestedKey,
    partial: Partial<TRoot[TSectionKey][TNestedKey]>
): Pick<TRoot, TSectionKey> => {
    const section = state[sectionKey] as Record<Key, unknown>;
    const currentValue = section[nestedKey as Key] as object;

    return {
        [sectionKey]: {
            ...section,
            [nestedKey]: {
                ...currentValue,
                ...(partial as object)
            }
        } as TRoot[TSectionKey]
    } as Pick<TRoot, TSectionKey>;
};

export const setSectionFieldState = <
    TRoot extends object,
    TSectionKey extends keyof TRoot,
    TFieldKey extends keyof TRoot[TSectionKey]
>(
    state: TRoot,
    sectionKey: TSectionKey,
    fieldKey: TFieldKey,
    value: TRoot[TSectionKey][TFieldKey]
): Pick<TRoot, TSectionKey> => ({
    [sectionKey]: {
        ...(state[sectionKey] as object),
        [fieldKey]: value
    } as TRoot[TSectionKey]
} as Pick<TRoot, TSectionKey>);

export const resetSectionState = <TRoot extends object, TSectionKey extends keyof TRoot>(
    state: TRoot,
    sectionKey: TSectionKey,
    initialState: Partial<TRoot[TSectionKey]>
): Pick<TRoot, TSectionKey> => ({
    [sectionKey]: {
        ...(state[sectionKey] as object),
        ...(initialState as object)
    } as TRoot[TSectionKey]
} as Pick<TRoot, TSectionKey>);

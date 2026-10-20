type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const assertWireMatch = <_TMatches extends true>(): void => {
};

export const assertSameFields = <TLocal, TWire>(
    ..._proof: Equal<keyof TLocal, keyof TWire> extends true ? [] : [never]
): void => {
};

export type { Equal };

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * Compile-time proof that a server-side enum still spells exactly the wire union
 * it mirrors.
 *
 * Some values need a runtime enum on the server (they are used as values, not just
 * types) while `@volt/contracts` declares them as a string union. That is two
 * declarations of one set, which is only safe if a mismatch fails the build:
 *
 * ```ts
 * assertWireMatch<Equal<`${AnalysisArtifactStatus}`, WireAnalysisArtifactStatus>>();
 * ```
 *
 * Adding a member to one side only makes the argument `false`, which does not
 * satisfy the `true` constraint, and `tsc` reports it at that line.
 */
export const assertWireMatch = <_TMatches extends true>(): void => {
    // A type-level assertion only; there is nothing to do at runtime.
};

/**
 * Compile-time proof that a server-side type declares the same *field names* as
 * the wire type it mirrors, without requiring the field types to match.
 *
 * Some entities legitimately differ only in serialization — `createdAt` is a `Date`
 * in the server and a `string` on the wire — so they cannot simply be re-exported.
 * What must not happen is a field being added on one side only, which this catches:
 *
 * ```ts
 * assertSameFields<RasterMetadata, WireRasterMetadata>();
 * ```
 */
export const assertSameFields = <TLocal, TWire>(
    ..._proof: Equal<keyof TLocal, keyof TWire> extends true ? [] : [never]
): void => {
    // A type-level assertion only.
};

export type { Equal };

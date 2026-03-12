export {
    buildKeys,
    createQuery,
    createSocketQuery,
    createInfiniteQuery,
    createMutation,
    createPaginatedQuery,
    withSuccess
} from './create-paginated-query';

export { createManagedMutation } from './managed-mutation';

export { createCachePolicy } from './cache-policies';

export type {
    QueryOptions,
    MutationOptions,
    InfiniteQueryOptions
} from './create-paginated-query';

export {
    upsertEntityInList,
    removeEntityFromList,
    patchPaginatedPage,
    patchInfinitePages,
    prependToFirstInfinitePage,
    batchInvalidateQueries
} from './cache-utils';

export { default as queryClient } from './query-client';

export { registerPrefetch, getPrefetchFactory } from './prefetch';

export type { PrefetchTarget, PrefetchContext, PrefetchFactory } from './prefetch';

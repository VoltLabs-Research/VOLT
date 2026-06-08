import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useEffect } from 'react';

export interface QueryState<TData> {
    data?: TData;
    isLoading: boolean;
    isFetching: boolean;
    error: unknown;
    refetch: () => Promise<unknown>;
}

const useQueryState = <TData>(
    query: QueryState<TData>,
    fallbackTitle: string
) => {
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    useEffect(() => {
        if (query.error) {
            checkAccessDeniedError(query.error);
        }
    }, [checkAccessDeniedError, query.error]);

    const error = query.error && !isAccessDeniedError(query.error)
        ? reportError(query.error, {
            surface: ErrorSurface.Silent,
            fallbackTitle
        }).title
        : null;

    return {
        data: query.data,
        isLoading: query.isLoading || query.isFetching,
        error,
        accessDenied,
        accessDeniedMessage,
        refresh: query.refetch
    };
};

export default useQueryState;

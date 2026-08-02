import queryClient from './query-client';
import { useMutation } from '@tanstack/react-query';
import type { MutationFunctionContext, QueryKey, UseMutationOptions } from '@tanstack/react-query';

export type MutationOptions<TData, TVariables> = Omit<
    UseMutationOptions<TData, Error, TVariables>,
    'mutationFn'
>;

type SuccessHandler<TData, TVariables, TOnMutateResult> = (
    data: TData,
    variables: TVariables,
    onMutateResult: TOnMutateResult,
    context: MutationFunctionContext
) => unknown;

type MutationInvalidationKeys<TData, TVariables, TOnMutateResult = unknown> =
    QueryKey[]
    | ((
        data: TData,
        variables: TVariables,
        onMutateResult: TOnMutateResult,
        context: MutationFunctionContext
    ) => QueryKey[]);

/**
 * Chains a factory's own success handler ahead of the caller's, so passing
 * `onSuccess` to a generated hook adds to the built-in behaviour instead of
 * silently replacing it.
 */
export const withSuccess = <TData, TVariables, TOnMutateResult = unknown>(
    handler: (data: TData, variables: TVariables, onMutateResult: TOnMutateResult, context: MutationFunctionContext) => void,
    options?: { onSuccess?: SuccessHandler<TData, TVariables, TOnMutateResult> }
): ((data: TData, variables: TVariables, onMutateResult: TOnMutateResult, context: MutationFunctionContext) => void) => {
    return (data, variables, onMutateResult, context) => {
        handler(data, variables, onMutateResult, context);
        options?.onSuccess?.(data, variables, onMutateResult, context);
    };
};

export const createMutation = <TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    onSuccess?: SuccessHandler<TData, TVariables, unknown>
) => {
    return (options?: MutationOptions<TData, TVariables>) => useMutation<TData, Error, TVariables>({
        ...options,
        mutationFn,
        onSuccess: onSuccess
            ? withSuccess((data, variables, onMutateResult, context) => {
                void onSuccess(data, variables, onMutateResult, context);
            }, options)
            : options?.onSuccess
    });
};

/** A mutation that invalidates a fixed or result-derived set of keys once it lands. */
export const createInvalidatingMutation = <TData, TVariables, TOnMutateResult = unknown>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    invalidationKeys: MutationInvalidationKeys<TData, TVariables, TOnMutateResult>,
    onSuccess?: SuccessHandler<TData, TVariables, TOnMutateResult>
) => {
    return createMutation<TData, TVariables>(mutationFn, async (data, variables, onMutateResult, context) => {
        const keys = typeof invalidationKeys === 'function'
            ? invalidationKeys(data, variables, onMutateResult as TOnMutateResult, context)
            : invalidationKeys;

        await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
        await onSuccess?.(data, variables, onMutateResult as TOnMutateResult, context);
    });
};

import { useMutation } from '@tanstack/react-query';
import type { MutationFunctionContext } from '@tanstack/query-core';
import { withSuccess } from './create-paginated-query';
import type { MutationOptions } from './create-paginated-query';

type ManagedSuccessHandler<TData, TVariables> = (
    data: TData,
    variables: TVariables,
    onMutateResult: unknown,
    context: MutationFunctionContext
) => unknown;

export const createManagedMutation = <TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    onManagedSuccess?: ManagedSuccessHandler<TData, TVariables>
) => {
    return (options?: MutationOptions<TData, TVariables>) => useMutation<TData, Error, TVariables>({
        ...options,
        mutationFn,
        onSuccess: onManagedSuccess
            ? withSuccess((data, variables, onMutateResult, context) => {
                void onManagedSuccess(data, variables, onMutateResult, context);
            }, options)
            : options?.onSuccess
    });
};

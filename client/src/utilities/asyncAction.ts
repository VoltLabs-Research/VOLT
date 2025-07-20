import type { StoreApi } from 'zustand';

export type ZustandSet<TState> = (
    partial: Partial<TState> | ((state: TState) => Partial<TState>),
    replace?: boolean
) => void;

export type ZustandGet<TState> = () => TState;

interface BaseState{
    error: string | null;
    isLoading: boolean;
}

type LoadingKey<TState> = {
    [K in keyof TState]: TState[K] extends boolean ? K : never;
}[keyof TState];

interface AsyncActionOptions<TState, TResponse>{
    loadingKey: LoadingKey<TState>;
    onSuccess: (response: TResponse, state: TState) => Partial<TState>;
    onError?: (error: any, state: TState) => Partial<TState>;
}

export const createAsyncAction = <TState extends BaseState>(
    set: StoreApi<TState>['setState'],
    /* get */ _: StoreApi<TState>['getState']
) => {
    return async <TResponse>(
        apiCall: () => Promise<TResponse>,
        options: AsyncActionOptions<TState, TResponse>
    ) => {
        set({ [options.loadingKey]: true, error: null } as Partial<TState>);
        try{
            const response = await apiCall();
            set((state) => ({
                ...options.onSuccess(response, state),
                [options.loadingKey]: false
            } as Partial<TState>));
        }catch(err: any){
            const errorData = err.response?.data?.message || err.message || 'An unknown error occurred';
            set({ error: errorData, [options.loadingKey]: false } as Partial<TState>);
            throw errorData;
        }
    };
};
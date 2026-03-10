import type { SileoOptions } from 'sileo';

export interface PromiseToastOptions<T = unknown> {
    loading: SileoOptions;
    success: SileoOptions | ((data: T) => SileoOptions);
    error: SileoOptions;
}

interface CreatePromiseToastOptionsInput {
    loading: string;
    success: string;
    error: string;
}

interface CreateCrudToastOptionsInput {
    action: string;
    subject: string;
    success?: string;
    error?: string;
}

export const createPromiseToastOptions = ({
    loading,
    success,
    error
}: CreatePromiseToastOptionsInput): PromiseToastOptions => ({
    loading: { title: loading },
    success: { title: success },
    error: { title: error }
});

export const createCrudToastOptions = ({
    action,
    subject,
    success,
    error
}: CreateCrudToastOptionsInput): PromiseToastOptions => {
    const normalizedAction = action.trim();
    const normalizedSubject = subject.trim();
    const baseSubject = normalizedSubject.toLowerCase();

    return createPromiseToastOptions({
        loading: `${normalizedAction} ${baseSubject}...`,
        success: success ?? `${normalizedSubject} updated`,
        error: error ?? `Failed to ${normalizedAction.toLowerCase()} ${baseSubject}`
    });
};

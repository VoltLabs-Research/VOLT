import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { SECRET_KEY_PAGE_CLASS, SECRET_KEY_PAGE_MAIN_CLASS } from './secret-key-page-styles';
import type { ReactNode } from 'react';

interface SecretKeyPageShellProps {
    header: ReactNode;
    children: ReactNode;
}

interface SecretKeyRecoveryViewProps {
    header: ReactNode;
    title: string;
    description: string;
    onRetry: () => void;
}

interface SecretKeyEmptyViewProps {
    header: ReactNode;
    message: string;
}

interface SecretKeyAsyncStateProps {
    header: ReactNode;
    isLoading: boolean;
    error: unknown;
    loadingView: ReactNode;
    errorTitle: string;
    errorFallbackDescription: string;
    emptyMessage: string;
    onRetry: () => void;
}

const SecretKeyPageShell = ({ header, children }: SecretKeyPageShellProps) => (
    <div className={SECRET_KEY_PAGE_CLASS}>
        <div className={SECRET_KEY_PAGE_MAIN_CLASS}>
            {header}
            {children}
        </div>
    </div>
);

const SecretKeyRecoveryView = ({
    header,
    title,
    description,
    onRetry
}: SecretKeyRecoveryViewProps) => (
    <SecretKeyPageShell header={header}>
        <RecoveryState
            title={title}
            description={description}
            tone={RecoveryStateTone.Error}
            retryLabel='Try again'
            onRetry={onRetry}
        />
    </SecretKeyPageShell>
);

const SecretKeyEmptyView = ({ header, message }: SecretKeyEmptyViewProps) => (
    <SecretKeyPageShell header={header}>
        <div className='flex p-12 items-center justify-center'>
            <p className='text-base text-muted'>{message}</p>
        </div>
    </SecretKeyPageShell>
);

/**
 * Loading / error / empty boundary shared by the secret key pages, rendered while their
 * metrics payload is still absent.
 *
 * This used to be bravais's `AsyncBoundary` with `state={{ loading, error: error ??
 * undefined, empty: true }}` and `children={null}`. Its five-way switch is inlined here
 * — for this one call site there is no `accessDenied` slot and `empty` is always true,
 * so the whole of it reduces to the three branches below. Two of its properties are
 * load-bearing and preserved exactly:
 *
 *   • **error beats loading.** A refetch that is `loading` while still holding a stale
 *     error shows the error, not the spinner. The obvious `isLoading ? … : error ? …`
 *     rewrite inverts that.
 *   • **the error test is `!== undefined && !== null`, not truthiness**, so a falsy
 *     error value (`0`, `''`, `false`, `NaN`) still takes the error branch.
 */
export const SecretKeyAsyncState = ({
    header,
    isLoading,
    error,
    loadingView,
    errorTitle,
    errorFallbackDescription,
    emptyMessage,
    onRetry
}: SecretKeyAsyncStateProps) => {
    if (error !== undefined && error !== null) {
        return (
            <SecretKeyRecoveryView
                header={header}
                title={errorTitle}
                description={error instanceof Error ? error.message : errorFallbackDescription}
                onRetry={onRetry}
            />
        );
    }

    if (isLoading) {
        return <>{loadingView}</>;
    }

    return (
        <SecretKeyEmptyView
            header={header}
            message={emptyMessage}
        />
    );
};

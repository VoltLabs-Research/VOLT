import { AsyncBoundary } from '@voltstack/bravais';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
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
    <div className='h-dvh secret-key-page text-foreground'>
        <div className='flex flex-col gap-8 w-full secret-key-page-main'>
            {header}
            {children}
        </div>
    </div>
);

export const SecretKeyRecoveryView = ({
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

export const SecretKeyEmptyView = ({ header, message }: SecretKeyEmptyViewProps) => (
    <SecretKeyPageShell header={header}>
        <div className='flex p-12 items-center justify-center'>
            <p className='text-base text-muted'>{message}</p>
        </div>
    </SecretKeyPageShell>
);

/**
 * Loading / error / empty boundary shared by the secret key pages, rendered while their
 * metrics payload is still absent.
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
}: SecretKeyAsyncStateProps) => (
    <AsyncBoundary
        state={{
            loading: isLoading,
            error: error ?? undefined,
            empty: true
        }}
        loading={loadingView}
        error={(boundaryError: unknown) => (
            <SecretKeyRecoveryView
                header={header}
                title={errorTitle}
                description={boundaryError instanceof Error ? boundaryError.message : errorFallbackDescription}
                onRetry={onRetry}
            />
        )}
        empty={(
            <SecretKeyEmptyView
                header={header}
                message={emptyMessage}
            />
        )}
    >
        {null}
    </AsyncBoundary>
);

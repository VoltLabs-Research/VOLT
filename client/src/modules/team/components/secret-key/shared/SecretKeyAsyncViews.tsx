import { AsyncBoundary, Box, Stack, Text } from '@voltstack/bravais';
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
    <Box height='vh-max' className='secret-key-page text-primary'>
        <Stack gap='2' width='max' className='secret-key-page-main'>
            {header}
            {children}
        </Stack>
    </Box>
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
        <Box display='flex' p='3' className='items-center justify-center'>
            <Text as='p' size='lg' tone='muted'>{message}</Text>
        </Box>
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

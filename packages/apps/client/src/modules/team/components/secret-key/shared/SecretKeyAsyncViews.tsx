import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import type { ReactNode } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

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
    <Scrollable className='h-full text-foreground'>
        <div className='flex flex-col gap-8 w-full max-w-[1600px] mx-auto md:py-4 md:px-8 min-[1440px]:px-12'>
            {header}
            {children}
        </div>
    </Scrollable>
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

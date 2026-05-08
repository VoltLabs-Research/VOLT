import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
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

export const SecretKeyPageShell = ({ header, children }: SecretKeyPageShellProps) => (
    <div className='secret-key-page vh-max color-primary'>
        <div className='secret-key-page-main d-flex column gap-2 w-max'>
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
        <div className='d-flex flex-center p-3'>
            <p className='color-muted font-size-3'>{message}</p>
        </div>
    </SecretKeyPageShell>
);

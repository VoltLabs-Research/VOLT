import AccessDenied from '@/shared/presentation/components/AccessDenied';
import { EmptyState } from '@voltstack/bravais';
import { AlertTriangle, CircleHelp, FileText } from 'lucide-react';
import type { ReactNode } from 'react';

export enum RecoveryStateTone {
    Empty = 'empty',
    Info = 'info',
    Error = 'error',
    AccessDenied = 'access-denied'
};

interface RecoveryStateProps {
    title: string;
    description: string;
    tone?: RecoveryStateTone;
    icon?: ReactNode;
    retryLabel?: string;
    isRetrying?: boolean;
    onRetry?: () => void;
    showBack?: boolean;
    className?: string;
};

const RecoveryState = ({
    title,
    description,
    tone = RecoveryStateTone.Empty,
    icon,
    retryLabel = 'Try again',
    isRetrying = false,
    onRetry,
    showBack = false,
    className
}: RecoveryStateProps) => {
    if (tone === RecoveryStateTone.AccessDenied) {
        return (
            <AccessDenied
                title={title}
                description={description}
                showBack={showBack}
                className={className}
            />
        );
    }

    let resolvedIcon = icon;
    if (!resolvedIcon) {
        if (tone === RecoveryStateTone.Error) {
            resolvedIcon = <AlertTriangle size={26} strokeWidth={1.5} />;
        } else if (tone === RecoveryStateTone.Info) {
            resolvedIcon = <CircleHelp size={26} strokeWidth={1.5} />;
        } else {
            resolvedIcon = <FileText size={26} strokeWidth={1.5} />;
        }
    }

    let buttonText: string | undefined;
    if (onRetry) {
        buttonText = retryLabel;
    }

    return (
        <EmptyState
            icon={resolvedIcon}
            title={title}
            description={description}
            buttonText={buttonText}
            buttonOnClick={onRetry}
            buttonIsLoading={isRetrying}
            className={className}
            announce
        />
    );
};

export default RecoveryState;

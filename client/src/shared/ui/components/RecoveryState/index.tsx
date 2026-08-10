import AccessDenied from '@/shared/ui/components/AccessDenied';
import { Button, EmptyStateRoot, Spinner, cn } from '@heroui/react';
import { AlertTriangle, CircleHelp, FileText } from 'lucide-react';
import { useId } from 'react';
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

    requiredPermissions?: string[];

    contactHint?: string;
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
    className,
    requiredPermissions,
    contactHint
}: RecoveryStateProps) => {
    const headingId = useId();

    if (tone === RecoveryStateTone.AccessDenied) {
        return (
            <AccessDenied
                title={title}
                description={description}
                showBack={showBack}
                className={className}
                requiredPermissions={requiredPermissions}
                contactHint={contactHint}
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

    return (
        <EmptyStateRoot<'section'>
            render={(props) => <section {...props} />}
            aria-labelledby={headingId}
            className={cn('flex flex-col items-center justify-center w-full h-full max-md:min-h-[300px]', className)}
        >
            <div className='flex flex-col items-center gap-6 text-center max-w-[320px] max-md:max-w-[90%]'>
                <span className='sr-only' aria-live='polite' aria-atomic='true'>
                    {title}. {description}
                </span>

                {resolvedIcon && (
                    <div className='flex flex-col items-center justify-center size-14 shrink-0 rounded-2xl bg-surface-tertiary text-muted'>
                        {resolvedIcon}
                    </div>
                )}

                <div className='flex flex-col gap-2 text-center'>
                    <h2 id={headingId} className='text-base font-medium text-foreground'>
                        {title}
                    </h2>
                    <span className='text-sm text-muted leading-normal'>
                        {description}
                    </span>
                </div>

                {onRetry && (
                    <Button
                        variant='primary'
                        size='sm'
                        className='mt-2'
                        isPending={isRetrying}
                        onPress={onRetry}
                    >
                        {isRetrying && <Spinner size='sm' color='current' />}
                        {retryLabel}
                    </Button>
                )}
            </div>
        </EmptyStateRoot>
    );
};

export default RecoveryState;

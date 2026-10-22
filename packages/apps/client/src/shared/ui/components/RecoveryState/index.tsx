import Loader from '@/shared/ui/components/Loader';
import AccessDenied from '@/shared/ui/components/AccessDenied';
import { Button, EmptyStateRoot, cn } from '@heroui/react';
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

    const isError = tone === RecoveryStateTone.Error;
    let resolvedIcon = icon;
    if (!resolvedIcon) {
        if (isError) {
            resolvedIcon = <AlertTriangle size={28} />;
        } else if (tone === RecoveryStateTone.Info) {
            resolvedIcon = <CircleHelp size={24} />;
        } else {
            resolvedIcon = <FileText size={24} />;
        }
    }

    return (
        <EmptyStateRoot<'section'>
            render={(props) => <section {...props} />}
            aria-labelledby={headingId}
            className={cn('flex flex-col items-center justify-center w-full h-full max-md:min-h-[300px]', className)}
        >
            <div className='flex flex-col items-center text-center max-w-sm max-md:max-w-[90%]'>
                <span className='sr-only' aria-live='polite' aria-atomic='true'>
                    {title}. {description}
                </span>

                {/* An empty state's mark sits in a round well; an error's stands on its own. */}
                <div
                    className={cn(
                        'flex shrink-0 items-center justify-center',
                        isError
                            ? 'text-danger [&_svg]:size-7'
                            : 'size-12 rounded-full bg-foreground/6 text-foreground [&_svg]:size-6'
                    )}
                    aria-hidden='true'
                >
                    {resolvedIcon}
                </div>

                <h2 id={headingId} className='mt-5 text-base font-medium text-foreground'>
                    {title}
                </h2>
                <p className='mt-2 text-base text-muted text-pretty'>
                    {description}
                </p>

                {onRetry && (
                    <Button
                        variant='primary'
                        size='sm'
                        className='mt-6'
                        isPending={isRetrying}
                        onPress={onRetry}
                    >
                        {isRetrying && <Loader size='sm' color='current' />}
                        {retryLabel}
                    </Button>
                )}
            </div>
        </EmptyStateRoot>
    );
};

export default RecoveryState;

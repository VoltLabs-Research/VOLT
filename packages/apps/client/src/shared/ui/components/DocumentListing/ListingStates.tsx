import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { Button } from '@heroui/react';
import { CircleAlert, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

// What a listing shows in place of its rows. The empty and access states fill the room where the
// table would be, with no tile behind them; an error keeps the page around it, so it reads as a notice, not a lone state.

interface ListingEmptyStateProps {
    icon?: ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    isActionPending?: boolean;
    onAction?: () => void;
};

export const ListingEmptyState = ({
    icon,
    title,
    description,
    actionLabel,
    isActionPending,
    onAction
}: ListingEmptyStateProps) => (
    <div className='flex min-h-0 flex-1 flex-col'>
        <RecoveryState
            icon={icon}
            title={title}
            description={description}
            retryLabel={actionLabel}
            isRetrying={isActionPending}
            onRetry={onAction}
            className='max-md:min-h-0'
        />
    </div>
);

interface ListingAccessDeniedStateProps {
    description: string;
};

export const ListingAccessDeniedState = ({ description }: ListingAccessDeniedStateProps) => (
    <div className='flex min-h-0 flex-1 flex-col'>
        <RecoveryState
            title='Access denied'
            description={description}
            tone={RecoveryStateTone.AccessDenied}
            className='max-md:min-h-0'
        />
    </div>
);

interface ListingErrorStateProps {
    title: string;
    description: string;
    retryLabel?: string;
    isRetrying?: boolean;
    onRetry?: () => void;
};

export const ListingErrorState = ({
    title,
    description,
    retryLabel = 'Try again',
    isRetrying = false,
    onRetry
}: ListingErrorStateProps) => (
    <div className='flex flex-col items-start gap-4 rounded-xl bg-foreground/4 p-5' role='alert'>
        <div className='flex min-w-0 flex-row items-start gap-3'>
            <CircleAlert size={16} className='mt-0.5 shrink-0' aria-hidden='true' />
            <div className='flex min-w-0 flex-col'>
                <p className='text-base font-medium text-foreground'>{title}</p>
                <p className='text-sm text-muted text-pretty'>{description}</p>
            </div>
        </div>
        {onRetry && (
            <Button variant='secondary' size='sm' isPending={isRetrying} onPress={onRetry}>
                <RefreshCw size={16} className={isRetrying ? 'animate-spin' : undefined} aria-hidden='true' />
                {retryLabel}
            </Button>
        )}
    </div>
);

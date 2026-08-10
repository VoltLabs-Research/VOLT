import { Skeleton } from '@heroui/react';
import AccessDenied from '@/shared/ui/components/AccessDenied';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

interface FileExplorerProps {
    headerLeft?: ReactNode;
    breadcrumb?: ReactNode;
    headerRight?: ReactNode;
    columns?: ReactNode;
    children?: ReactNode;
    isLoading?: boolean;
    isEmpty?: boolean;
    emptyMessage?: string;
    error?: string | null;
    skeletonCount?: number;
    accessDenied?: boolean;
    accessDeniedMessage?: string;
    onRetry?: () => void;
    isRetrying?: boolean;
};

const FileExplorer = ({
    headerLeft,
    breadcrumb,
    headerRight,
    columns,
    children,
    isLoading = false,
    isEmpty = false,
    emptyMessage = 'No files found',
    error,
    skeletonCount = 8,
    accessDenied = false,
    accessDeniedMessage,
    onRetry,
    isRetrying = false
}: FileExplorerProps) => {
    const stateMessage = useMemo(() => {
        if (accessDenied) {
            return accessDeniedMessage ?? 'Access denied.';
        }

        if (error) {
            return error;
        }

        if (isLoading) {
            return 'Loading files.';
        }

        if (isEmpty) {
            return emptyMessage;
        }

        return '';
    }, [accessDenied, accessDeniedMessage, emptyMessage, error, isEmpty, isLoading]);

    const hasHeader = Boolean(headerLeft || breadcrumb || headerRight);

    const renderContent = () => {
        if (accessDenied) {
            return (
                <AccessDenied
                    description={accessDeniedMessage}
                    showBack={false}
                    className='min-h-[240px]'
                />
            );
        }

        if(isLoading){
            return Array.from({ length: skeletonCount }).map((_, i) => (
                <div key={i} className='grid w-full grid-cols-[1fr_100px_100px_120px] items-center border-b border-border px-4 py-2.5 max-[900px]:grid-cols-[1fr] max-[900px]:items-start max-[900px]:gap-1 max-[900px]:py-3'>
                        <Skeleton className='size-[18px] rounded-full' />
                        <Skeleton className='h-5 w-3/5 rounded-md' />
                        <Skeleton className='h-[18px] w-[60px] rounded-md' />
                        <Skeleton className='h-[18px] w-20 rounded-md' />
                    </div>
            ));
        }

        if(error){
            return (
                <RecoveryState
                    title='Unable to load files'
                    description={error}
                    tone={RecoveryStateTone.Error}
                    onRetry={onRetry}
                    retryLabel='Try again'
                    isRetrying={isRetrying}
                    className='min-h-[240px]'
                />
            );
        }

        if(isEmpty){
            return (
                <RecoveryState
                    title='Nothing here yet'
                    description={emptyMessage}
                    className='min-h-[240px]'
                />
            );
        }

        return children;
    };

    return (
        <div className='flex flex-col h-full overflow-hidden'>
            <span className='sr-only' aria-live='polite' aria-atomic='true'>
                {stateMessage}
            </span>
            {hasHeader && (
                <div className='flex justify-between items-center gap-4 p-3 border-b border-border max-[900px]:flex-wrap'>
                    <div className='flex items-center gap-2'>
                        {headerLeft}
                    </div>

                    <div className='flex items-center flex-1 min-w-0 max-[900px]:order-3 max-[900px]:basis-full'>
                        {breadcrumb}
                    </div>

                    <div className='flex items-center gap-2'>
                        {headerRight}
                    </div>
                </div>
            )}

            {columns && (
                <div className='grid grid-cols-[1fr_100px_100px_120px] border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-[0.05em] text-muted max-[900px]:hidden'>
                    {columns}
                </div>
            )}

            <div className='flex-1 overflow-y-auto' role='list' aria-busy={isLoading || isRetrying}>
                {renderContent()}
            </div>
        </div>
    );
};

export default FileExplorer;

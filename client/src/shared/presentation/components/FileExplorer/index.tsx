import FileRowSkeleton from './FileRowSkeleton';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import './FileExplorer.css';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

export interface FileExplorerProps {
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
                    className='file-explorer-state'
                />
            );
        }

        if(isLoading){
            return Array.from({ length: skeletonCount }).map((_, i) => (
                <FileRowSkeleton key={i} />
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
                    className='file-explorer-state'
                />
            );
        }

        if(isEmpty){
            return (
                <RecoveryState
                    title='Nothing here yet'
                    description={emptyMessage}
                    className='file-explorer-state'
                />
            );
        }

        return children;
    };

    return (
        <div className='file-explorer d-flex column h-max overflow-hidden'>
            <span className='sr-only' aria-live='polite' aria-atomic='true'>
                {stateMessage}
            </span>
            {hasHeader && (
                <div className='file-explorer-header d-flex content-between items-center gap-1 p-075'>
                    <div className='file-explorer-header-left d-flex items-center gap-05'>
                        {headerLeft}
                    </div>

                    <div className='file-explorer-breadcrumb d-flex items-center flex-1'>
                        {breadcrumb}
                    </div>

                    <div className='file-explorer-header-right d-flex items-center gap-05'>
                        {headerRight}
                    </div>
                </div>
            )}

            {columns && (
                <div className='file-explorer-columns'>
                    {columns}
                </div>
            )}

            <div className='file-explorer-list flex-1 y-auto' role='list' aria-busy={isLoading || isRetrying}>
                {renderContent()}
            </div>
        </div>
    );
};

export default FileExplorer;

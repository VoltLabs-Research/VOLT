import FileRowSkeleton from './FileRowSkeleton';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Container from '@/shared/presentation/components/Container';
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
        <Container className='file-explorer d-flex column h-max overflow-hidden'>
            <span className='file-explorer-live-region' aria-live='polite' aria-atomic='true'>
                {stateMessage}
            </span>
            {hasHeader && (
                <Container className='file-explorer-header d-flex content-between items-center gap-1 p-075'>
                    <Container className='file-explorer-header-left d-flex items-center gap-05'>
                        {headerLeft}
                    </Container>

                    <Container className='file-explorer-breadcrumb d-flex items-center flex-1'>
                        {breadcrumb}
                    </Container>

                    <Container className='file-explorer-header-right d-flex items-center gap-05'>
                        {headerRight}
                    </Container>
                </Container>
            )}

            {columns && (
                <Container className='file-explorer-columns'>
                    {columns}
                </Container>
            )}

            <Container className='file-explorer-list flex-1 y-auto' role='list' aria-busy={isLoading || isRetrying}>
                {renderContent()}
            </Container>
        </Container>
    );
};

export default FileExplorer;

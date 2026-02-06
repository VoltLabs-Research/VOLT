import type { ReactNode } from 'react';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import FileRowSkeleton from './FileRowSkeleton';
import './FileExplorer.css';

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
    skeletonCount = 8
}: FileExplorerProps) => {
    const renderContent = () => {
        if(isLoading){
            return Array.from({ length: skeletonCount }).map((_, i) => (
                <FileRowSkeleton key={i} />
            ));
        }

        if(error){
            return (
                <Container className='file-explorer-message p-2 text-center'>
                    <Paragraph className='color-danger'>{error}</Paragraph>
                </Container>
            );
        }

        if(isEmpty){
            return (
                <Container className='file-explorer-message p-2 text-center'>
                    <Paragraph className='color-muted'>{emptyMessage}</Paragraph>
                </Container>
            );
        }

        return children;
    };

    return (
        <Container className='file-explorer d-flex column h-max overflow-hidden'>
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

            {columns && (
                <Container className='file-explorer-columns'>
                    {columns}
                </Container>
            )}

            <Container className='file-explorer-list flex-1 y-auto'>
                {renderContent()}
            </Container>
        </Container>
    );
};

export default FileExplorer;

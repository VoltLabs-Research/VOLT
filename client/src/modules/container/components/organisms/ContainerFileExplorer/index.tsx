import { useContainerFilesQuery, useContainerFileContentQuery } from '../../../hooks/queries';
import { useRemoteExplorer } from '@/shared/api/remote-explorer';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { IoFolderOutline, IoDocumentOutline, IoArrowBack } from 'react-icons/io5';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import FileExplorer from '@/shared/presentation/components/FileExplorer';
import FileExplorerRow from '@/shared/presentation/components/FileExplorer/FileExplorerRow';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ContainerFile } from '@/modules/container/api/entities/container-file';
import './ContainerFileExplorer.css';

interface ContainerFileExplorerProps {
    containerId: string;
};

const ContainerFileExplorer = ({ containerId }: ContainerFileExplorerProps) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const viewingFile = searchParams.get('file');

    const remoteExplorer = useRemoteExplorer({
        initialPath: '/',
        normalizeRootPath: (path) => path || '/',
        resetParamKeys: ['file']
    });

    const { data: filesResponse, isLoading, error: filesError, refetch: refetchFiles, isFetching } = useContainerFilesQuery(
        { containerId, path: remoteExplorer.path },
        { enabled: !!containerId }
    );
    const files = filesResponse?.files ?? [];
    const filesErrorMessage = filesError
        ? reportError(filesError, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'Failed to load files'
        }).title
        : null;

    const explorer = remoteExplorer.bindState<ContainerFile>({
        entries: files,
        cwd: remoteExplorer.path,
        isLoading,
        error: filesErrorMessage,
        refresh: refetchFiles,
        isRefreshing: isFetching && !isLoading
    });

    const filePath = viewingFile ? explorer.joinPath(viewingFile) : '';

    const { data: fileContentResponse, error: fileContentError } = useContainerFileContentQuery(
        { containerId, path: filePath },
        { enabled: !!containerId && !!viewingFile && !!filePath }
    );
    const fileContent = fileContentResponse?.content;

    const handleFileClick = (fileName: string) => {
        setSearchParams((previousParams) => {
            const nextParams = new URLSearchParams(previousParams);
            nextParams.set('file', fileName);
            return nextParams;
        });
    };

    const closeFileViewer = () => {
        setSearchParams((previousParams) => {
            const nextParams = new URLSearchParams(previousParams);
            nextParams.delete('file');
            return nextParams;
        });
    };

    const handleFileItemClick = (file: ContainerFile) => {
        const entryPath = explorer.joinPath(file.name);
        explorer.setSelectedPath(entryPath);

        if (file.isDirectory) {
            explorer.navigateTo(entryPath);
            return;
        }

        handleFileClick(file.name);
    };

    const renderFileIcon = (isDirectory: boolean) => {
        if (isDirectory) {
            return <IoFolderOutline />;
        }

        return <IoDocumentOutline />;
    };

    if(viewingFile && fileContent !== undefined && fileContent !== null){
        return (
            <Container className='d-flex column h-max gap-1'>
                <Container className='d-flex items-center gap-1 container-file-viewer-header'>
                    <Button variant='ghost' intent='neutral' size='sm' leftIcon={<IoArrowBack />} onClick={closeFileViewer}>
                        Back
                    </Button>
                    <span>{viewingFile}</span>
                </Container>
                <pre className='container-file-content overflow-auto flex-1 p-1'>{fileContent}</pre>
            </Container>
        );
    }

    if (viewingFile && fileContentError) {
        const message = reportError(fileContentError, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'Failed to open file'
        }).title;

        return (
            <Container className='d-flex column h-max gap-1'>
                <Container className='d-flex items-center gap-1 container-file-viewer-header'>
                    <Button variant='ghost' intent='neutral' size='sm' leftIcon={<IoArrowBack />} onClick={closeFileViewer}>
                        Back
                    </Button>
                    <span>{viewingFile}</span>
                </Container>
                <Paragraph className='container-file-empty-folder'>{message}</Paragraph>
            </Container>
        );
    }

    const columns = useMemo(() => {
        return (
            <>
                <span>Name</span>
                <span>Type</span>
                <span>Size</span>
                <span>Modified</span>
            </>
        );
    }, []);

    const explorerHeaderLeft = useMemo(() => {
        return (
            <Container className='d-flex items-center gap-1 flex-1'>
                <Tooltip content='Go to Parent Directory' placement='bottom'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={explorer.goUp} disabled={explorer.isAtRoot}>
                        <IoArrowBack />
                    </Button>
                </Tooltip>
                <span className='container-file-current-path'>{explorer.cwd}</span>
            </Container>
        );
    }, [explorer.cwd, explorer.goUp, explorer.isAtRoot]);

    const explorerHeaderRight = useMemo(() => {
        return (
            <RefreshButton
                label='Refresh'
                variant='outline'
                intent='white'
                onClick={() => {
                    void explorer.refresh();
                }}
                isLoading={explorer.isRefreshing}
            />
        );
    }, [explorer.isRefreshing, explorer.refresh]);

    return (
        <FileExplorer
            headerLeft={explorerHeaderLeft}
            headerRight={explorerHeaderRight}
            columns={columns}
            isLoading={explorer.isLoading}
            isEmpty={!explorer.error && explorer.entries.length === 0}
            emptyMessage='Empty folder'
            error={explorer.error}
            onRetry={() => {
                explorer.refresh();
            }}
            isRetrying={explorer.isRefreshing}
        >
            {explorer.entries.map((file) => {
                const entryPath = explorer.joinPath(file.name);

                return (
                    <FileExplorerRow
                        key={`${file.name}-${file.isDirectory ? 'dir' : 'file'}`}
                        icon={renderFileIcon(file.isDirectory)}
                        name={file.name}
                        type={file.isDirectory ? 'Folder' : 'File'}
                        size={file.size ? String(file.size) : undefined}
                        date={file.date}
                        isSelected={explorer.selectedPath === entryPath}
                        onClick={() => handleFileItemClick(file)}
                    />
                );
            })}
        </FileExplorer>
    );
};

export default ContainerFileExplorer;

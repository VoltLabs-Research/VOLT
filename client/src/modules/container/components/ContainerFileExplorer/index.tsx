import { useContainerFilesQuery, useContainerFileContentQuery } from '../../hooks/queries';
import { useRemoteExplorer } from '@/shared/api/remote-explorer';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { IoFolderOutline, IoDocumentOutline, IoArrowBack } from 'react-icons/io5';
import FileExplorer from '@/shared/ui/components/FileExplorer';
import FileExplorerRow from '@/shared/ui/components/FileExplorer/FileExplorerRow';
import RefreshButton from '@/shared/ui/components/RefreshButton';
import { Button, Row, Stack, Text, Tooltip } from '@voltstack/bravais';
import { useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { ContainerFile } from '@volt/contracts/modules/container/domain';
import './ContainerFileExplorer.css';

interface ContainerFileExplorerProps {
    containerId: string;
}

const ContainerFileExplorer = ({ containerId }: ContainerFileExplorerProps) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const viewingFile = searchParams.get('file');

    const remoteExplorer = useRemoteExplorer({
        initialPath: '/',
        normalizeRootPath: (path) => path || '/',
        resetParamKeys: ['file']
    });

    const { data: filesResponse, isLoading, error: filesError, refetch: refetchFiles, isFetching } = useContainerFilesQuery({
        containerId,
        path: remoteExplorer.path
    });
    const filesErrorMessage = filesError
        ? reportError(filesError, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'Failed to load files'
        }).title
        : null;

    const explorer = remoteExplorer.bindState<ContainerFile>({
        entries: filesResponse?.files ?? [],
        cwd: remoteExplorer.path,
        isLoading,
        error: filesErrorMessage,
        refresh: refetchFiles,
        isRefreshing: isFetching && !isLoading
    });

    const filePath = viewingFile ? explorer.joinPath(viewingFile) : '';

    const { data: fileContentResponse, error: fileContentError } = useContainerFileContentQuery(
        {
            containerId,
            path: filePath
        },
        { enabled: !!filePath }
    );
    const fileContent = fileContentResponse?.content;

    const updateViewingFile = (fileName: string | null) => {
        setSearchParams((previousParams) => {
            const nextParams = new URLSearchParams(previousParams);

            if (fileName === null) {
                nextParams.delete('file');
            } else {
                nextParams.set('file', fileName);
            }

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

        updateViewingFile(file.name);
    };

    const renderFileViewer = (body: ReactNode) => (
        <Stack height='max' gap='1'>
            <Row className='container-file-viewer-header' gap='1'>
                <Button variant='ghost' intent='neutral' size='sm' leftIcon={<IoArrowBack />} onClick={() => updateViewingFile(null)}>
                    Back
                </Button>
                <span>{viewingFile}</span>
            </Row>
            {body}
        </Stack>
    );

    if(viewingFile && fileContent !== undefined){
        return renderFileViewer(<pre className='container-file-content overflow-auto flex-1 p-1'>{fileContent}</pre>);
    }

    if (viewingFile && fileContentError) {
        const message = reportError(fileContentError, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'Failed to open file'
        }).title;

        return renderFileViewer(<Text as='p' className='container-file-empty-folder'>{message}</Text>);
    }

    return (
        <FileExplorer
            headerLeft={
                <Row gap='1' flex='1'>
                    <Tooltip content='Go to Parent Directory' placement='bottom'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' aria-label='Go to parent directory' title='Go to parent directory' onClick={explorer.goUp} disabled={explorer.isAtRoot}>
                            <IoArrowBack />
                        </Button>
                    </Tooltip>
                    <span className='container-file-current-path'>{explorer.cwd}</span>
                </Row>
            }
            headerRight={
                <RefreshButton
                    label='Refresh'
                    variant='outline'
                    intent='white'
                    onClick={() => {
                        explorer.refresh();
                    }}
                    isLoading={explorer.isRefreshing}
                />
            }
            columns={
                <>
                    <span>Name</span>
                    <span>Type</span>
                    <span>Size</span>
                    <span>Modified</span>
                </>
            }
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
                        icon={file.isDirectory ? <IoFolderOutline /> : <IoDocumentOutline />}
                        name={file.name}
                        type={file.isDirectory ? 'Folder' : 'File'}
                        size={file.size || undefined}
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

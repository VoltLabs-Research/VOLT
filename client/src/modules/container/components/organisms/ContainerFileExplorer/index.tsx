import { useContainerFilesQuery, useContainerFileContentQuery } from '../../../hooks/queries';
import { IoFolderOutline, IoDocumentOutline, IoArrowBack } from 'react-icons/io5';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import FileExplorer from '@/shared/presentation/components/FileExplorer';
import FileExplorerRow from '@/shared/presentation/components/FileExplorer/FileExplorerRow';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import { getApiErrorMessage } from '@/shared/errors/notify-api-error';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { useMemo } from 'react';
import './ContainerFileExplorer.css';

interface ContainerFileExplorerProps {
    containerId: string;
};

const ContainerFileExplorer = ({ containerId }: ContainerFileExplorerProps) => {
    const { searchParams, updateSearchParams, setParam, removeParam } = useSearchParamsState();

    const path = searchParams.get('path') || '/';
    const viewingFile = searchParams.get('file');

    const { data: filesResponse, isLoading, error: filesError, refetch: refetchFiles, isFetching } = useContainerFilesQuery(
        { containerId, path },
        { enabled: !!containerId }
    );
    const files = filesResponse?.files ?? [];
    const filesErrorMessage = filesError ? getApiErrorMessage(filesError, 'Failed to load files') : null;

    let filePath = '';
    if (viewingFile) {
        if (path === '/') {
            filePath = `/${viewingFile}`;
        } else {
            filePath = `${path}/${viewingFile}`;
        }
    }

    const { data: fileContentResponse, error: fileContentError } = useContainerFileContentQuery(
        { containerId, path: filePath },
        { enabled: !!containerId && !!viewingFile && !!filePath }
    );
    const fileContent = fileContentResponse?.content;

    const handleNavigate = (folderName: string) => {
        let newPath = '';
        if (path === '/') {
            newPath = `/${folderName}`;
        } else {
            newPath = `${path}/${folderName}`;
        }
        updateSearchParams({ path: newPath });
    };

    const handleGoUp = () => {
        if(path === '/') return;
        const parts = path.split('/');
        parts.pop();
        const newPath = parts.join('/') || '/';
        updateSearchParams({ path: newPath === '/' ? null : newPath });
    };

    const handleFileClick = (fileName: string) => {
        setParam('file', fileName);
    };

    const closeFileViewer = () => {
        removeParam('file');
    };

    const handleFileItemClick = (fileName: string, isDirectory: boolean) => {
        if (isDirectory) {
            handleNavigate(fileName);
            return;
        }

        handleFileClick(fileName);
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
        const message = getApiErrorMessage(fileContentError, 'Failed to open file');

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

    const fileRows = useMemo(() => {
        return files.map((file) => (
            <FileExplorerRow
                key={`${file.name}-${file.isDirectory ? 'dir' : 'file'}`}
                icon={renderFileIcon(file.isDirectory)}
                name={file.name}
                type={file.isDirectory ? 'Folder' : 'File'}
                size={file.size}
                date={file.date}
                onClick={() => handleFileItemClick(file.name, file.isDirectory)}
            />
        ));
    }, [files]);

    return (
        <FileExplorer
            headerLeft={(
                <Container className='d-flex items-center gap-1 flex-1'>
                    <Tooltip content='Go to Parent Directory' placement='bottom'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleGoUp} disabled={path === '/'}>
                            <IoArrowBack />
                        </Button>
                    </Tooltip>
                    <span className='container-file-current-path'>{path}</span>
                </Container>
            )}
            headerRight={(
                <RefreshButton
                    label='Refresh'
                    variant='outline'
                    intent='white'
                    onClick={() => {
                        void refetchFiles();
                    }}
                    isLoading={isFetching && !isLoading}
                />
            )}
            columns={columns}
            isLoading={isLoading}
            isEmpty={!filesErrorMessage && files.length === 0}
            emptyMessage='Empty folder'
            error={filesErrorMessage}
            onRetry={() => {
                void refetchFiles();
            }}
            isRetrying={isFetching && !isLoading}
        >
            {fileRows}
        </FileExplorer>
    );
};

export default ContainerFileExplorer;

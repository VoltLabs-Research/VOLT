import { useContainerFilesQuery, useContainerFileContentQuery } from '../../../hooks/queries';
import { IoFolderOutline, IoDocumentOutline, IoArrowBack } from 'react-icons/io5';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import FileRowSkeleton from '@/shared/presentation/components/FileExplorer/FileRowSkeleton';
import ApiError from '@/shared/errors/ApiError';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import './ContainerFileExplorer.css';

interface ContainerFileExplorerProps {
    containerId: string;
};

const ContainerFileExplorer = ({ containerId }: ContainerFileExplorerProps) => {
    const { searchParams, updateSearchParams, setParam, removeParam } = useSearchParamsState();

    const path = searchParams.get('path') || '/';
    const viewingFile = searchParams.get('file');

    const { data: filesResponse, isLoading, refetch: refetchFiles } = useContainerFilesQuery(
        { containerId, path },
        { enabled: !!containerId }
    );
    const files = filesResponse?.files ?? [];

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
        let message = 'Failed to open file';
        if (fileContentError instanceof ApiError) {
            message = fileContentError.getFriendlyMessage();
        } else if (fileContentError instanceof Error) {
            message = fileContentError.message;
        }

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

    let filesContent = null;
    if (isLoading) {
        filesContent = (
            <>
                {Array.from({ length: 8 }).map((_, i) => <FileRowSkeleton key={i} className='container-file-item items-center' />)}
            </>
        );
    } else {
        filesContent = (
            <>
                {files.length === 0 && <Paragraph className='container-file-empty-folder'>Empty folder</Paragraph>}
                {files.map((file, index) => (
                    <Container
                        key={index}
                        className='container-file-item items-center cursor-pointer'
                        onClick={() => handleFileItemClick(file.name, file.isDirectory)}
                    >
                        <span className='d-flex items-center content-center container-file-icon'>
                            {renderFileIcon(file.isDirectory)}
                        </span>
                        <span className='container-file-name font-weight-5'>{file.name}</span>
                        <span className='container-file-size'>{file.size}</span>
                        <span className='container-file-date'>{file.date}</span>
                    </Container>
                ))}
            </>
        );
    }

    return (
        <Container>
            <Container className='d-flex content-between items-center container-file-explorer-header'>
                <Container className='d-flex items-center gap-1 flex-1'>
                    <Tooltip content='Go to Parent Directory' placement='bottom'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleGoUp} disabled={path === '/'}>
                            <IoArrowBack />
                        </Button>
                    </Tooltip>
                    <span className='container-file-current-path'>{path}</span>
                </Container>
                <RefreshButton 
                    label='Refresh' 
                    variant='outline' 
                    intent='white' 
                    onClick={() => refetchFiles()} 
                />
            </Container>

            <Container className='d-flex flex-1 y-scroll column'>
                {filesContent}
            </Container>
        </Container>
    );
};

export default ContainerFileExplorer;

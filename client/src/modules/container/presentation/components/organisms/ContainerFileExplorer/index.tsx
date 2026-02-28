import { useState, useEffect } from 'react';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { IoFolderOutline, IoDocumentOutline, IoArrowBack } from 'react-icons/io5';
import useContainerUseCases from '../../../hooks/use-container-use-cases';
import { showError } from '@/shared/presentation/hooks/toast';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import FileRowSkeleton from '@/shared/presentation/components/FileExplorer/FileRowSkeleton';
import type { ContainerFile } from '@/modules/container/domain/entities';
import './ContainerFileExplorer.css';

interface ContainerFileExplorerProps {
    containerId: string;
};

const ContainerFileExplorer = ({ containerId }: ContainerFileExplorerProps) => {
    const { searchParams, updateSearchParams, setParam, removeParam } = useSearchParamsState();
    const [files, setFiles] = useState<ContainerFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [fileContent, setFileContent] = useState<string | null>(null);

    const path = searchParams.get('path') || '/';
    const viewingFile = searchParams.get('file');

    const { containerRepository } = useContainerUseCases();

    const fetchFiles = async () => {
        setIsLoading(true);
        try {
            const result = await containerRepository.getFiles(containerId, { path });
            setFiles(result);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, [containerId, path]);

    useEffect(() => {
        if(!viewingFile){
            setFileContent(null);
            return;
        }

        const loadFile = async () => {
            const filePath = path === '/' ? `/${viewingFile}` : `${path}/${viewingFile}`;
            try {
                const content = await containerRepository.readFile(containerId, filePath);
                setFileContent(content);
            } catch {
                showError({ title: 'Failed to read file' });
                removeParam('file');
            }
        };

        loadFile();
    }, [containerId, path, viewingFile]);

    const handleNavigate = (folderName: string) => {
        const newPath = path === '/' ? `/${folderName}` : `${path}/${folderName}`;
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

    if(viewingFile && fileContent !== null){
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
                    onClick={fetchFiles} 
                />
            </Container>

            <Container className='d-flex flex-1 y-scroll column'>
                {isLoading ? (
                    <>
                        {Array.from({ length: 8 }).map((_, i) => <FileRowSkeleton key={i} className='container-file-item items-center' />)}
                    </>
                ) : (
                    <>
                        {files.length === 0 && <Paragraph className='container-file-empty-folder'>Empty folder</Paragraph>}
                        {files.map((file, index) => (
                            <Container
                                key={index}
                                className='container-file-item items-center cursor-pointer'
                                onClick={() => file.isDirectory ? handleNavigate(file.name) : handleFileClick(file.name)}
                            >
                                <span className='d-flex items-center content-center container-file-icon'>
                                    {file.isDirectory ? <IoFolderOutline /> : <IoDocumentOutline />}
                                </span>
                                <span className='container-file-name font-weight-5'>{file.name}</span>
                                <span className='container-file-size'>{file.size}</span>
                                <span className='container-file-date'>{file.updatedAt}</span>
                            </Container>
                        ))}
                    </>
                )}
            </Container>
        </Container>
    );
};

export default ContainerFileExplorer;

import React, { useState, useEffect } from 'react';
import { IoFolder, IoDocument, IoArrowBack } from 'react-icons/io5';
import useToast from '@/hooks/ui/use-toast';
import containerApi from '@/services/api/container';
import Container from '@/components/primitives/Container';
import './ContainerFileExplorer.css';
import Paragraph from '@/components/primitives/Paragraph';

interface FileItem {
    name: string;
    isDirectory: boolean;
    size: string;
    permissions: string;
    updatedAt: string;
}

interface ContainerFileExplorerProps {
    containerId: string;
}

const ContainerFileExplorer: React.FC<ContainerFileExplorerProps> = ({ containerId }) => {
    const [currentPath, setCurrentPath] = useState('/');
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [viewingFile, setViewingFile] = useState<string | null>(null);
    const { showError } = useToast();

    useEffect(() => {
        fetchFiles(currentPath);
    }, [containerId, currentPath]);

    const fetchFiles = async (path: string) => {
        setLoading(true);
        try {
            const data = await containerApi.fileExplorer.list(containerId, path);
            setFiles(data.files);
        } catch (error) {
            showError('Failed to fetch files');
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (folderName: string) => {
        const newPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
        setCurrentPath(newPath);
    };

    const handleGoUp = () => {
        if (currentPath === '/') return;
        const parts = currentPath.split('/');
        parts.pop();
        const newPath = parts.join('/') || '/';
        setCurrentPath(newPath);
    };

    const handleFileClick = async (fileName: string) => {
        const filePath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
        setLoading(true);
        try {
            const data = await containerApi.fileExplorer.read(containerId, filePath);
            setFileContent(data.content);
            setViewingFile(fileName);
        } catch (error) {
            showError('Failed to read file');
        } finally {
            setLoading(false);
        }
    };

    const closeFileViewer = () => {
        setViewingFile(null);
        setFileContent(null);
    };

    if (viewingFile) {
        return (
            <Container className='d-flex column h-max gap-1'>
                <Container className="d-flex items-center gap-1 viewer-header">
                    <button onClick={closeFileViewer} className="d-flex items-center gap-05 back-btn-small">
                        <IoArrowBack /> Back
                    </button>
                    <span>{viewingFile}</span>
                </Container>
                <pre className="file-content">{fileContent}</pre>
            </Container>
        );
    }

    return (
        <Container>
            <Container className="d-flex content-between items-center explorer-header">
                <Container className="d-flex items-center gap-1 flex-1">
                    <button onClick={handleGoUp} disabled={currentPath === '/'} className="up-btn">
                        <IoArrowBack />
                    </button>
                    <span className="current-path">{currentPath}</span>
                </Container>
                <button onClick={() => fetchFiles(currentPath)} className="refresh-btn-small">
                    Refresh
                </button>
            </Container>

            <Container className="d-flex flex-1 y-scroll column">
                {loading ? (
                    <Paragraph>Loading...</Paragraph>
                ) : (
                    <>
                        {files.length === 0 && <Paragraph className="empty-folder">Empty folder</Paragraph>}
                        {files.map((file, index) => (
                            <Container
                                key={index}
                                className="file-item"
                                onClick={() => file.isDirectory ? handleNavigate(file.name) : handleFileClick(file.name)}
                            >
                                <span className="d-flex items-center content-center file-icon">
                                    {file.isDirectory ? <IoFolder className="folder-icon" /> : <IoDocument className="doc-icon" />}
                                </span>
                                <span className="file-name">{file.name}</span>
                                <span className="file-size">{file.size}</span>
                                <span className="file-date">{file.updatedAt}</span>
                            </Container>
                        ))}
                    </>
                )}
            </Container>
        </Container>
    );
};

export default ContainerFileExplorer;

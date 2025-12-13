import React, { useState, useEffect } from 'react';
import { IoFolder, IoDocument, IoArrowBack } from 'react-icons/io5';
import useToast from '@/hooks/ui/use-toast';
import containerApi from '@/services/api/container';
import './ContainerFileExplorer.css';

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
            <div className="file-viewer">
                <div className="viewer-header">
                    <button onClick={closeFileViewer} className="back-btn-small">
                        <IoArrowBack /> Back
                    </button>
                    <span>{viewingFile}</span>
                </div>
                <pre className="file-content">{fileContent}</pre>
            </div>
        );
    }

    return (
        <div className="container-file-explorer">
            <div className="explorer-header">
                <div className="path-bar">
                    <button onClick={handleGoUp} disabled={currentPath === '/'} className="up-btn">
                        <IoArrowBack />
                    </button>
                    <span className="current-path">{currentPath}</span>
                </div>
                <button onClick={() => fetchFiles(currentPath)} className="refresh-btn-small">
                    Refresh
                </button>
            </div>

            <div className="file-list">
                {loading ? (
                    <div className="loading-files">Loading...</div>
                ) : (
                    <>
                        {files.length === 0 && <div className="empty-folder">Empty folder</div>}
                        {files.map((file, index) => (
                            <div
                                key={index}
                                className="file-item"
                                onClick={() => file.isDirectory ? handleNavigate(file.name) : handleFileClick(file.name)}
                            >
                                <span className="file-icon">
                                    {file.isDirectory ? <IoFolder className="folder-icon" /> : <IoDocument className="doc-icon" />}
                                </span>
                                <span className="file-name">{file.name}</span>
                                <span className="file-size">{file.size}</span>
                                <span className="file-date">{file.updatedAt}</span>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};

export default ContainerFileExplorer;

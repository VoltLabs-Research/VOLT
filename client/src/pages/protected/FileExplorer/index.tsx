/// <reference types="vite/client" />
import { useEffect, useState } from 'react';
import useTrajectoryFS, { type FsEntry } from '@/stores/trajectory-vfs';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import FileExplorer from '@/components/organisms/trajectory/FileExplorer';
import {
    LuLayoutList,
    LuFolder,
    LuFile,
    LuRefreshCw,
    LuArrowLeft,
    LuArrowRight,
    LuTrash,
    LuFolderPlus,
    LuSettings,
    LuArrowUp,
    LuDownload
} from 'react-icons/lu';
import { CircularProgress } from '@mui/material';
import { formatSize } from '@/utilities/scene-utils';
import './TrajectoryFileExplorer.css';
import Paragraph from '@/components/primitives/Paragraph';
import { BreadcrumbsSkeleton, HeaderIconSkeleton, FileRowSkeleton } from '@/components/organisms/trajectory/FileExplorer/Skeletons';

type TrajectoryFileExplorerProps = {
    height?: number | string;
    onFileOpen?: (entry: FsEntry) => void;
};

const TrajectoryFileExplorer = ({ onFileOpen }: TrajectoryFileExplorerProps) => {
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewFileName, setPreviewFileName] = useState<string>('');
    const [previewMaximized, setPreviewMaximized] = useState(false);
    const [previewMinimized, setPreviewMinimized] = useState(false);

    const {
        cwd,
        entries,
        breadcrumbs,
        selected,
        loading,
        historyIndex,
        history,
        trajectories,
        loadingTrajectories,
        currentTrajectoryId,
        init,
        enter,
        up,
        back,
        forward,
        refresh,
        select,
        download,
        navigateToTrajectory
    } = useTrajectoryFS();

    const canBack = historyIndex > 0;
    const canForward = historyIndex < history.length - 1;

    const headerIcons = [{
        Icon: LuArrowLeft,
        onClick: back,
        disabled: !canBack,
    }, {
        Icon: LuArrowRight,
        onClick: forward,
        disabled: !canForward
    }, {
        Icon: LuArrowUp,
        onClick: up,
        disabled: !cwd
    }];

    const headerRightIcons = [{
        Icon: LuRefreshCw,
        onClick: refresh,
        disabled: false
    }, {
        Icon: LuLayoutList,
        onClick: () => { },
        disabled: true
    }, {
        Icon: LuFolderPlus,
        onclick: () => { },
        disabled: true
    }];

    const bottomNavIcons = [{
        Icon: LuSettings,
        title: 'Settings'
    }, {
        Icon: LuTrash,
        title: 'Trash'
    }];

    useEffect(() => {
        init();
    }, []);

    const loadImagePreview = async (entry: FsEntry) => {
        setPreviewLoading(true);
        setPreviewFileName(entry.name);

        try {
            const token = localStorage.getItem('authToken');
            const API_BASE_URL = import.meta.env.VITE_API_URL + '/api';

            const response = await fetch(`${API_BASE_URL}/trajectory-vfs/download?path=${encodeURIComponent(entry.relPath)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setPreviewImage(base64String);
                setPreviewLoading(false);
            };
            reader.onerror = (error) => {
                console.error('Error reading image as base64:', error);
                setPreviewImage(null);
                setPreviewLoading(false);
            };
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error('Error loading image preview:', error);
            setPreviewImage(null);
            setPreviewLoading(false);
        }
    };

    const closePreview = () => {
        setPreviewImage(null);
        setPreviewFileName('');
        setPreviewMaximized(false);
        setPreviewMinimized(false);
    };

    const handleDownloadPreview = () => {
        if (!previewImage || !previewFileName) return;
        const a = document.createElement('a');
        a.href = previewImage;
        a.download = previewFileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const handleDoubleClick = (e: FsEntry) => {
        if (e.type === 'dir') {
            enter(e.name);
        } else {
            const isPNG = e.ext?.toLowerCase() === 'png' || e.name.toLowerCase().endsWith('.png');
            if (isPNG) {
                loadImagePreview(e);
            } else if (onFileOpen) {
                onFileOpen(e);
            } else {
                download(e.relPath);
            }
        }
    };

    const breadcrumbsContent = loading ? (
        <BreadcrumbsSkeleton />
    ) : (
        breadcrumbs.map(({ name }, i) => (
            <div className='d-flex items-center search-breadcrumb-container' key={`${name}-${i}`}>
                <Paragraph className='search-breadcrumb-name'>{name}</Paragraph>
            </div>
        ))
    );

    const headerRightIconsContent = headerRightIcons.map(({ Icon, onClick, disabled }, index) => (
        <i
            className={`file-explorer-header-icon-container ${disabled ? 'is-disabled' : ''}`}
            onClick={onClick}
            key={index + '-right'}
        >
            {loading ? <HeaderIconSkeleton /> : <Icon size={20} />}
        </i>
    ));

    const fileListHeader = ['name', 'type', 'size', 'Modified'].map((title, index) => (
        <div className={'file-explorer-list-column ' + title} key={index}>{title}</div>
    ));

    const fileListContent = loading ? (
        Array.from({ length: 30 }).map((_, i) => <FileRowSkeleton key={`s-${i}`} />)
    ) : entries.map((e) => (
        <div
            key={e.relPath}
            className={`file-explorer-list-row ${selected === e.relPath ? 'selected' : ''} items-center`}
            onDoubleClick={() => handleDoubleClick(e)}
            onClick={() => select(e.relPath)}
        >
            <div className='d-flex items-center gap-05 file-explorer-list-column file-explorer-list-name-container'>
                <i className='file-explorer-file-icon-container'>
                    {e.type === 'dir' ? <LuFolder /> : <LuFile />}
                </i>

                <Paragraph className='file-explorer-file-name'>{e.name}</Paragraph>
            </div>

            <div className='file-explorer-list-column'>
                {e.type === 'dir' ? 'Folder' : e.ext || 'File'}
            </div>

            <div className='file-explorer-list-column'>
                {formatSize(e.size || 0)}
            </div>

            <div className='file-explorer-list-column'>
                {formatTimeAgo(e.mtime || '')}
            </div>
        </div>
    ));

    return (
        <>
            <FileExplorer
                title="Trajectories"
                breadcrumbs={breadcrumbsContent}
                headerRightIcons={headerRightIconsContent}
                fileListHeader={fileListHeader}
                fileListContent={fileListContent}
            />

            {(previewImage || previewLoading) && !previewMinimized && (
                <div className={`d-flex column gap-1 trajectory-fs-preview-wrapper ${previewMaximized ? 'maximized' : ''}`} style={{
                    borderRadius: '8px',
                    padding: '1rem',
                }}>
                    <div
                        className='d-flex column gap-05 trajectory-fs-preview-header'
                        style={{
                            cursor: 'grab',
                            userSelect: 'none',
                        }}
                    >
                        <div className="d-flex items-center content-between" style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            paddingBottom: '0.75rem',
                        }}>
                            <div className="d-flex items-center gap-05">
                                <LuFile size={20} />
                                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                                    {previewFileName}
                                </span>
                            </div>
                            <div className="d-flex gap-05">
                                <i
                                    onClick={handleDownloadPreview}
                                    style={{
                                        cursor: 'pointer',
                                        padding: '0.5rem',
                                        borderRadius: '4px',
                                    }}
                                    className='d-flex items-center content-center trajectory-fs-preview-icon'
                                >
                                    <LuDownload size={20} />
                                </i>
                            </div>
                        </div>
                    </div>

                    <div className="d-flex items-center content-center" style={{
                        minWidth: '400px',
                        minHeight: '400px',
                        maxWidth: '80vw',
                        maxHeight: '70vh',
                    }}>
                        {previewLoading ? (
                            <CircularProgress />
                        ) : previewImage ? (
                            <img
                                src={previewImage}
                                alt={previewFileName}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    borderRadius: '4px',
                                }}
                            />
                        ) : (
                            <span>No image to display</span>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default TrajectoryFileExplorer;

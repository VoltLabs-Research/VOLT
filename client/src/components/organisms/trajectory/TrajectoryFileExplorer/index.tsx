import { useEffect, useState } from 'react';
import useTrajectoryFS, { type FsEntry } from '@/stores/trajectory-vfs';
import WindowIcons from '@/components/molecules/common/WindowIcons';
import Draggable from '@/components/atoms/common/Draggable';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import FileExplorerWindow from '@/components/organisms/trajectory/FileExplorerWindow';
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
import { Skeleton, Box, CircularProgress } from '@mui/material';
import { formatSize } from '@/utilities/scene-utils';

import './TrajectoryFileExplorer.css';

type TrajectoryFileExplorerProps = {
    height?: number | string;
    onFileOpen?: (entry: FsEntry) => void;
    onClose?: () => void;
};

const TrajectoryFileExplorer = ({ onFileOpen, onClose }: TrajectoryFileExplorerProps) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
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

    const loadImagePreview = async(entry: FsEntry) => {
        setPreviewLoading(true);
        setPreviewFileName(entry.name);

        try{
            const token = localStorage.getItem('authToken');
            const API_BASE_URL = import.meta.env.VITE_API_URL + '/api';

            const response = await fetch(`${API_BASE_URL}/trajectory-vfs/download?path=${encodeURIComponent(entry.relPath)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if(!response.ok){
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
        }catch(error){
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
        if(!previewImage || !previewFileName) return;
        const a = document.createElement('a');
        a.href = previewImage;
        a.download = previewFileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const handleDoubleClick = (e: FsEntry) => {
        if(e.type === 'dir'){
            enter(e.name);
        }else{
            const isPNG = e.ext?.toLowerCase() === 'png' || e.name.toLowerCase().endsWith('.png');
            if(isPNG){
                loadImagePreview(e);
            }else if(onFileOpen){
                onFileOpen(e);
            }else{
                download(e.relPath);
            }
        }
    };

    const BreadcrumbsSkeleton = () => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: .8 }}>
            {Array.from({ length: 3 }).map((_, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Skeleton variant="text" width={60 + i * 20} height={18} />
                    {i < 2 && <Box component="span" sx={{ mx: .6, fontSize: 12 }}>/</Box>}
                </Box>
            ))}
        </Box>
    );

    const HeaderIconSkeleton = () => (
        <Skeleton variant="circular" width={24} height={24} />
    );

    const FileRowSkeleton = () => (
        <div className='file-explorer-list-row'>
            <div className='file-explorer-list-column file-explorer-list-name-container'>
                <Skeleton variant="circular" width={18} height={18} />
                <Skeleton variant="text" width="60%" height={18} />
            </div>
            <div className='file-explorer-list-column'>
                <Skeleton variant="text" width="70%" height={18} />
            </div>
            <div className='file-explorer-list-column'>
                <Skeleton variant="text" width="50%" height={18} />
            </div>
            <div className='file-explorer-list-column'>
                <Skeleton variant="text" width="80%" height={18} />
            </div>
        </div>
    );

    const TrajectoryItemSkeleton = () => (
        <div className='file-explorer-nav-item'>
            <Skeleton variant="text" width="80%" height={18} />
        </div>
    );

    if(isMinimized) return null;

    const navItems = (
        <>
            {loadingTrajectories ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <TrajectoryItemSkeleton key={`skeleton-${i}`} />
                ))
            ) : trajectories.length === 0 ? (
                <div className='file-explorer-nav-item'>
                    <h3 className='file-explorer-nav-item-title' style={{ opacity: 0.5 }}>No trajectories available</h3>
                </div>
            ) : (
                trajectories.map((traj) => (
                    <div
                        className={`file-explorer-nav-item ${currentTrajectoryId === traj.id ? 'active' : ''}`}
                        key={traj.id}
                        onClick={() => navigateToTrajectory(traj.id)}
                        style={{ cursor: 'pointer' }}
                    >
                        <h3 className='file-explorer-nav-item-title'>{traj.name}</h3>
                    </div>
                ))
            )}
        </>
    );

    const bottomNavItemsContent = bottomNavIcons.map(({ Icon, title }, index) => (
        <div className='file-explorer-left-bottom-nav-icon-container' key={'bottom-icon-' + index}>
            <i className='file-explorer-left-bottom-nav-icon'>
                <Icon size={15} />
            </i>
            <p className='file-explorer-left-bottom-nav-title'>{title}</p>
        </div>
    ));

    const headerLeftIconsContent = headerIcons.map(({ Icon, onClick, disabled }, index) => (
        <i
            className={`file-explorer-header-icon-container ${disabled ? 'is-disabled' : ''}`}
            onClick={onClick}
            key={index}
        >
            {loading ? <HeaderIconSkeleton /> : <Icon size={20} />}
        </i>
    ));

    const breadcrumbsContent = loading ? (
        <BreadcrumbsSkeleton />
    ) : (
        breadcrumbs.map(({ name }, i) => (
            <div className='search-breadcrumb-container' key={`${name}-${i}`}>
                <p className='search-breadcrumb-name'>{name}</p>
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
            className={`file-explorer-list-row ${selected === e.relPath ? 'selected' : ''}`}
            onDoubleClick={() => handleDoubleClick(e)}
            onClick={() => select(e.relPath)}
        >
            <div className='file-explorer-list-column file-explorer-list-name-container'>
                <i className='file-explorer-file-icon-container'>
                    {e.type === 'dir' ? <LuFolder /> : <LuFile />}
                </i>

                <p className='file-explorer-file-name'>{e.name}</p>
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

    return(
        <>
            <FileExplorerWindow
                title="Trajectories"
                isMaximized={isMaximized}
                setIsMaximized={setIsMaximized}
                onClose={onClose}
                onMinimize={() => setIsMinimized(true)}
                navItems={navItems}
                bottomNavItems={bottomNavItemsContent}
                headerLeftIcons={headerLeftIconsContent}
                breadcrumbs={breadcrumbsContent}
                headerRightIcons={headerRightIconsContent}
                fileListHeader={fileListHeader}
                fileListContent={fileListContent}
            />

            {(previewImage || previewLoading) && !previewMinimized && (
                <Draggable
                    className='trajectory-fs-image-preview primary-surface'
                    enabled
                    bounds='viewport'
                    axis='both'
                    doubleClickToDrag={true}
                    handle='.trajectory-fs-preview-header'
                    scaleWhileDragging={0.98}
                    resizable={true}
                    minWidth={400}
                    minHeight={400}
                >
                    <div className={`trajectory-fs-preview-wrapper ${previewMaximized ? 'maximized' : ''}`} style={{
                        borderRadius: '8px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                    }}>
                        <div
                            className='trajectory-fs-preview-header'
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                cursor: 'grab',
                                userSelect: 'none',
                            }}
                        >
                            <WindowIcons
                                onClose={closePreview}
                                onExpand={() => setPreviewMaximized(!previewMaximized)}
                                onMinimize={() => setPreviewMinimized(true)}
                            />

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                paddingBottom: '0.75rem',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <LuFile size={20} />
                                    <span style={{ fontSize: '14px', fontWeight: 500 }}>
                                        {previewFileName}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <i
                                        onClick={handleDownloadPreview}
                                        style={{
                                            cursor: 'pointer',
                                            padding: '0.5rem',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                        className='trajectory-fs-preview-icon'
                                    >
                                        <LuDownload size={20} />
                                    </i>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
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
                </Draggable>
            )}
        </>
    );
};

export default TrajectoryFileExplorer;

import { useEffect, useState } from 'react';
import useTrajectoryFS, { type FsEntry } from '@/stores/trajectory-fs';
import WindowIcons from '@/components/molecules/WindowIcons';
import Draggable from '@/components/atoms/Draggable';
import formatTimeAgo from '@/utilities/formatTimeAgo';
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
    LuArrowUp } from 'react-icons/lu';
import { Skeleton, Box } from '@mui/material';
import { formatSize } from '@/utilities/scene-utils';
import { IoSearchOutline } from 'react-icons/io5';
import './TrajectoryFileExplorer.css';

type TrajectoryFileExplorerProps = {
    trajectoryId: string;
    height?: number | string;
    onFileOpen?: (entry: FsEntry) => void;
    onClose?: () => void;
};

const TrajectoryFileExplorer = ({ trajectoryId, onFileOpen, onClose }: TrajectoryFileExplorerProps) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    
    const {
        cwd,
        entries,
        breadcrumbs,
        selected,
        loading,
        error,
        showHidden,
        historyIndex,
        history,
        init,
        open,
        enter,
        up,
        back,
        forward,
        refresh,
        select,
        download,
        setShowHidden
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
        onClick: () => {},
        disabled: true
    }, {
        Icon: LuFolderPlus,
        onclick: () => {},
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
        if(trajectoryId){
            init(trajectoryId);
        }
    }, [trajectoryId]);

    const handleDoubleClick = (e: FsEntry) => {
        if(e.type === 'dir'){
            enter(e.name);
        }else{
            if(onFileOpen){
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
        <div className='trajectory-fs-list-row'>
            <div className='trajectory-fs-list-column trajectory-fs-list-name-container'>
                <Skeleton variant="circular" width={18} height={18} />
                <Skeleton variant="text" width="60%" height={18} />
            </div>
            <div className='trajectory-fs-list-column'>
                <Skeleton variant="text" width="70%" height={18} />
            </div>
            <div className='trajectory-fs-list-column'>
                <Skeleton variant="text" width="50%" height={18} />
            </div>
            <div className='trajectory-fs-list-column'>
                <Skeleton variant="text" width="80%" height={18} />
            </div>
        </div>
        );

    if(isMinimized) return null;

    return (
        <Draggable 
            className='trajectory-fs-container primary-surface'
            enabled
            bounds='viewport'
            axis='both'
            doubleClickToDrag={true}
            handle='.trajectory-fs-nav-title'
            scaleWhileDragging={0.95}
            resizable={true}
            minWidth={800}
            minHeight={500}
        >
            <div className={`trajectory-fs-wrapper ${isMaximized ? 'maximized' : ''}`}>
            <div className='trajectory-fs-left-container'>
                <div className='trajectory-fs-left-top-container'>
                    <WindowIcons 
                        onClose={onClose}
                        onExpand={() => setIsMaximized(!isMaximized)}
                        onMinimize={() => setIsMinimized(true)}
                    />

                    <div className='trajectory-fs-nav-container'>
                        <div className='trajectory-fs-nav'>
                            <h3 className='trajectory-fs-nav-title'>Trajectories</h3>
                            <div className='trajectory-fs-nav-items'>
                                {['Dump Impact', 'SC Lattice Test', '1200K 17nm Strain 0'].map((title, index) => (
                                    <div className='trajectory-fs-nav-item' key={index}>
                                        <h3 className='trajectory-fs-nav-item-title'>{title}</h3>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className='trajectory-fs-left-bottom-container'>
                    <div className='trajectory-fs-left-bottom-nav-container'>
                        {bottomNavIcons.map(({ Icon, title }, index) => (
                            <div className='trajectory-fs-left-bottom-nav-icon-container' key={'bottom-icon-' + index}>
                                <i className='trajectory-fs-left-bottom-nav-icon'>
                                    <Icon size={15} />
                                </i>
                                <p className='trajectory-fs-left-bottom-nav-title'>{title}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className='trajectory-fs-right-container'>
                <div className='trajectory-fs-right-header'>
                    {headerIcons.map(({ Icon, onClick, disabled }, index) => (
                        <i 
                            className={`trajectory-fs-header-icon-container ${disabled ? 'is-disabled' : ''}`}
                            onClick={onClick}
                            key={index}
                        >
                            {loading ? <HeaderIconSkeleton /> : <Icon size={20} />}
                        </i>
                    ))}

                    <div className='search-container trajectory-fs-search-container'>
                        <i className='search-icon-container'>
                            <IoSearchOutline />
                        </i>

                        <div className='search-breadcrumbs-container'>
                            {loading ? (
                                <BreadcrumbsSkeleton />
                            ) : (
                                breadcrumbs.map(({ name }, i) => (
                                    <div className='search-breadcrumb-container' key={`${name}-${i}`}>
                                        <p className='search-breadcrumb-name'>{name}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {headerRightIcons.map(({ Icon, onClick, disabled }, index) => (
                        <i 
                            className={`trajectory-fs-header-icon-container ${disabled ? 'is-disabled' : ''}`}
                            onClick={onClick}
                            key={index + '-right'}
                        >
                            {loading ? <HeaderIconSkeleton /> : <Icon size={20} />}
                        </i>
                    ))}
                </div>
                <div className='trajectory-fs-list-headrow'>
                    {['name', 'type', 'size', 'Modified'].map((title, index) => (
                        <div className={'trajectory-fs-list-column ' + title} key={index}>{title}</div>
                    ))}
                </div>
                
                <div className='trajectory-fs-list-body'>
                    {loading ? (
                        Array.from({ length: 30 }).map((_, i) => <FileRowSkeleton key={`s-${i}`} />)
                    ) : entries.map((e) => (
                        <div
                            key={e.relPath}
                            className={`trajectory-fs-list-row ${selected === e.relPath ? 'selected' : ''}`}
                            onDoubleClick={() => handleDoubleClick(e)}
                            onClick={() => select(e.relPath)}
                        >
                            <div className='trajectory-fs-list-column trajectory-fs-list-name-container'>
                                <i className='trajectory-fs-file-icon-container'>
                                    {e.type === 'dir' ? <LuFolder /> : <LuFile />}
                                </i>

                                <p className='trajectory-fs-file-name'>{e.name}</p>
                            </div>

                            <div className='trajectory-fs-list-column'>
                                {e.type === 'dir' ? 'Folder' : e.ext || 'File'}
                            </div>

                            <div className='trajectory-fs-list-column'>
                                {formatSize(e.size || 0)}
                            </div>

                            <div className='trajectory-fs-list-column'>
                                {formatTimeAgo(e.mtime || '')}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            </div>
        </Draggable>
    );
};

export default TrajectoryFileExplorer;
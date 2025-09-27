import React, { useEffect, useMemo } from 'react';
import useTrajectoryFS, { type FsEntry } from '@/stores/trajectory-fs';
import WindowIcons from '@/components/molecules/WindowIcons';
import Draggable from '@/components/atoms/Draggable';
import { 
    LuFolder, 
    LuFile, 
    LuRefreshCw, 
    LuArrowLeft, 
    LuArrowRight, 
    LuUpload, 
    LuDownload, 
    LuEyeOff, 
    LuEye } from 'react-icons/lu';
import './TrajectoryFileExplorer.css';
import { formatSize } from '@/utilities/scene-utils';
import formatTimeAgo from '@/utilities/formatTimeAgo';

type TrajectoryFileExplorerProps = {
    trajectoryId: string;
    height?: number | string;
    onFileOpen?: (entry: FsEntry) => void;
};

const TrajectoryFileExplorer = ({ trajectoryId, height = 520, onFileOpen }: TrajectoryFileExplorerProps) => {
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

    useEffect(() => {
        if(trajectoryId){
            init(trajectoryId);
        }
    }, [trajectoryId]);

    const canBack = historyIndex > 0;
    const canForward = historyIndex < history.length - 1;
    const containerStyle = useMemo(() => ({ height: typeof height === 'number' ? `${height}px` : height }), [height]);
   
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

    return (
        <Draggable className='trajectory-fs-container primary-surface'>
            <div className='trajectory-fs-left-container'>
                <WindowIcons />

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

            <div className='trajectory-fs-right-container'>
                <div className='trajectory-fs-list-headrow'>
                    {['name', 'type', 'size', 'Modified'].map((title, index) => (
                        <div className={'trajectory-fs-list-column ' + title} key={index}>{title}</div>
                    ))}
                </div>
                
                <div className='trajectory-fs-list-body'>
                    {entries.map((e) => (
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
        </Draggable>
    );
};

export default TrajectoryFileExplorer;
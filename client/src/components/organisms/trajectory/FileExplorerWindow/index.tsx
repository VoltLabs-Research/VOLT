import React from 'react';
import { createPortal } from 'react-dom';
import Draggable from '@/components/atoms/common/Draggable';
import WindowIcons from '@/components/molecules/common/WindowIcons';
import './FileExplorerWindow.css';

interface FileExplorerWindowProps {
    title: string;
    isMaximized: boolean;
    setIsMaximized: (value: boolean) => void;
    onClose?: () => void;
    onMinimize?: () => void;

    // Left Sidebar
    navItems: React.ReactNode;
    bottomNavItems?: React.ReactNode;

    // Right Content Header
    headerLeftIcons?: React.ReactNode;
    breadcrumbs?: React.ReactNode;
    headerRightIcons?: React.ReactNode;

    // Right Content List
    fileListHeader: React.ReactNode;
    fileListContent: React.ReactNode;
    hidden?: boolean;
}

const FileExplorerWindow: React.FC<FileExplorerWindowProps> = ({
    title,
    isMaximized,
    setIsMaximized,
    onClose,
    onMinimize,
    navItems,
    bottomNavItems,
    headerLeftIcons,
    breadcrumbs,
    headerRightIcons,
    fileListHeader,
    fileListContent,
    hidden
}) => {
    return createPortal(
        <Draggable
            className='file-explorer-container primary-surface'
            enabled={!isMaximized}
            bounds='viewport'
            axis='both'
            doubleClickToDrag={true}
            handle='.file-explorer-nav-title'
            scaleWhileDragging={0.95}
            resizable={true}
            minWidth={800}
            minHeight={500}
            style={{
                // Ensure it respects the CSS class position/z-index unless maximized
                width: isMaximized ? '100vw' : undefined,
                height: isMaximized ? '100vh' : undefined,
                top: isMaximized ? 0 : undefined,
                left: isMaximized ? 0 : 'calc(50% - 500px)',
                display: hidden ? 'none' : undefined
            }}
        >
            <div className={`file-explorer-wrapper ${isMaximized ? 'maximized' : ''}`}>
                <div className='file-explorer-left-container'>
                    <div className='file-explorer-left-top-container'>
                        <WindowIcons
                            onClose={onClose}
                            onExpand={() => setIsMaximized(!isMaximized)}
                            onMinimize={onMinimize}
                        />

                        <div className='file-explorer-nav-container'>
                            <div className='file-explorer-nav'>
                                <h3 className='file-explorer-nav-title'>{title}</h3>
                                <div className='file-explorer-nav-items'>
                                    {navItems}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='file-explorer-left-bottom-container'>
                        <div className='file-explorer-left-bottom-nav-container'>
                            {bottomNavItems}
                        </div>
                    </div>
                </div>

                <div className='file-explorer-right-container'>
                    <div className='file-explorer-right-header'>
                        {headerLeftIcons}

                        <div className='file-explorer-search-container'>
                            <i className='search-icon-container'>
                                {/* Icon should be passed in breadcrumbs or here? 
                                    TrajectoryFileExplorer has IoSearchOutline hardcoded.
                                    We'll assume breadcrumbs includes the container inner structure or just the list.
                                    Actually TrajectoryFileExplorer has:
                                    <div className='search-container trajectory-fs-search-container'>
                                        <i ...><IoSearchOutline /></i>
                                        <div className='search-breadcrumbs-container'>...</div>
                                    </div>
                                    
                                    I'll make breadcrumbs just the content, and keep the container here to match style.
                                */}
                                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M456.69 421.39 362.6 327.3a173.81 173.81 0 0 0 34.84-104.58C397.44 126.38 319.06 48 222.72 48S48 126.38 48 222.72s78.38 174.72 174.72 174.72A173.81 173.81 0 0 0 327.3 362.6l94.09 94.09a25 25 0 0 0 35.3-35.3zM97.92 222.72a124.8 124.8 0 1 1 124.8 124.8 124.8 124.8 0 0 1-124.8-124.8z"></path></svg>
                            </i>
                            <div className='search-breadcrumbs-container'>
                                {breadcrumbs}
                            </div>
                        </div>

                        {headerRightIcons}
                    </div>

                    <div className='file-explorer-list-headrow'>
                        {fileListHeader}
                    </div>

                    <div className='file-explorer-list-body'>
                        {fileListContent}
                    </div>
                </div>
            </div>
        </Draggable>,
        document.body
    );
};

export default FileExplorerWindow;

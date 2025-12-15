import React from 'react';
import { createPortal } from 'react-dom';
import Draggable from '@/components/atoms/common/Draggable';
import WindowIcons from '@/components/molecules/common/WindowIcons';
import './FileExplorerWindow.css';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';

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
                width: isMaximized ? '100vw' : undefined,
                height: isMaximized ? '100vh' : undefined,
                top: isMaximized ? 0 : undefined,
                left: isMaximized ? 0 : 'calc(50% - 500px)',
                display: hidden ? 'none' : undefined
            }}
        >
            <Container className={`d-flex overflow-hidden file-explorer-wrapper ${isMaximized ? 'maximized' : ''}`}>
                <Container className='d-flex column content-between'>
                    <Container className='d-flex column gap-3 file-explorer-left-top-container'>
                        <WindowIcons
                            onClose={onClose}
                            onExpand={() => setIsMaximized(!isMaximized)}
                            onMinimize={onMinimize}
                        />

                        <Container>
                            <Container className='d-flex column gap-05'>
                                <Title className='font-size-3 file-explorer-nav-title'>{title}</Title>
                                <Container className='d-flex column gap-025'>
                                    {navItems}
                                </Container>
                            </Container>
                        </Container>
                    </Container>

                    <Container className='p-1'>
                        <Container className='d-flex column gap-1-5'>
                            {bottomNavItems}
                        </Container>
                    </Container>
                </Container>

                <Container className='d-flex column p-1 h-max gap-05 file-explorer-right-container'>
                    <Container className='d-flex gap-2'>
                        {headerLeftIcons}

                        <Container className='d-flex items-center gap-075 file-explorer-search-container'>
                            <i className='search-icon-container'>
                                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M456.69 421.39 362.6 327.3a173.81 173.81 0 0 0 34.84-104.58C397.44 126.38 319.06 48 222.72 48S48 126.38 48 222.72s78.38 174.72 174.72 174.72A173.81 173.81 0 0 0 327.3 362.6l94.09 94.09a25 25 0 0 0 35.3-35.3zM97.92 222.72a124.8 124.8 0 1 1 124.8 124.8 124.8 124.8 0 0 1-124.8-124.8z"></path></svg>
                            </i>
                            <Container className='d-flex items-center'>
                                {breadcrumbs}
                            </Container>
                        </Container>

                        {headerRightIcons}
                    </Container>

                    <Container className='file-explorer-list-headrow'>
                        {fileListHeader}
                    </Container>

                    <Container className='y-scroll h-max file-explorer-list-body'>
                        {fileListContent}
                    </Container>
                </Container>
            </Container>
        </Draggable>,
        document.body
    );
};

export default FileExplorerWindow;

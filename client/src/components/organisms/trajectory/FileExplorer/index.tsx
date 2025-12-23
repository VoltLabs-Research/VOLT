import React from 'react';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import './FileExplorer.css';

interface FileExplorerProps {
    title: string;

    // Left Sidebar
    navItems?: React.ReactNode;
    bottomNavItems?: React.ReactNode;

    // Right Content Header
    headerLeftIcons?: React.ReactNode;
    breadcrumbs?: React.ReactNode;
    headerRightIcons?: React.ReactNode;

    // Right Content List
    fileListHeader: React.ReactNode;
    fileListContent: React.ReactNode;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
    title,
    navItems,
    bottomNavItems,
    headerLeftIcons,
    breadcrumbs,
    headerRightIcons,
    fileListHeader,
    fileListContent
}) => {
    return (
        <Container className='d-flex overflow-hidden file-explorer-wrapper h-max'>
            {(navItems && bottomNavItems) && (
                <Container className='d-flex column content-between'>
                    <Container className='d-flex column gap-3 file-explorer-left-top-container'>
                        <Container>
                            <Container className='d-flex column gap-05'>
                                <Title className='font-size-3 file-explorer-nav-title font-weight-5 u-select-none'>{title}</Title>
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
            )}

            <Container className='d-flex column p-1 h-max gap-05 file-explorer-right-container'>
                <Container className='d-flex gap-2'>
                    {headerLeftIcons}

                    <Container className='d-flex items-center gap-075 file-explorer-breadcrumbs-container'>
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
    );
};

export default FileExplorer;

import React from 'react';
import Container from '@/shared/presentation/components/primitives/Container';
import Title from '@/shared/presentation/components/primitives/Title';
import '@/shared/presentation/components/organisms/common/FileExplorer/FileExplorer.css';

interface FileExplorerProps {
    title: string;
    navItems?: React.ReactNode;
    bottomNavItems?: React.ReactNode;
    headerLeftIcons?: React.ReactNode;
    breadcrumbs?: React.ReactNode;
    headerRightIcons?: React.ReactNode;
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
        <Container className='d-flex overflow-hidden file-explorer-wrapper h-max w-max'>
            {(navItems && bottomNavItems) && (
                <Container className='d-flex column content-between'>
                    <Container className='d-flex column gap-3 file-explorer-left-top-container p-1'>
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

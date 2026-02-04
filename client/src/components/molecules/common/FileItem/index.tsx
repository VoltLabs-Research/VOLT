import React from 'react';
import { BsThreeDots } from 'react-icons/bs';
import '@/components/molecules/common/FileItem/FileItem.css';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';

interface FileItemProps {
    data: object;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

const FileItem: React.FC<FileItemProps> = ({
    data,
    isSelected,
    onSelect,
    onDelete
}) => {
    return(
        <Container
            className={`file-item cursor-pointer ${isSelected ? 'selected' : ''} items-center`}
            onClick={onSelect}
        >
            <Container className='d-flex content-between items-center'>
                <Title>{data.name}</Title>
                <i className='file-delete-icon-container'>
                    <BsThreeDots
                        onClick={onDelete}
                        className='file-delete-icon font-size-3 color-secondary cursor-pointer'
                    />
                </i>
            </Container>
        </Container>
    );
};

export default FileItem;

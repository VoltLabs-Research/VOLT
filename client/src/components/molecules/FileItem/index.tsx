import React from 'react';
import { BsThreeDots } from 'react-icons/bs';
import './FileItem.css';

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
    return (
        <div 
            className={`file-item ${isSelected ? 'selected' : ''}`}
            onClick={onSelect}
        >
            <div className='file-header-container'>
                <h4>{data.name}</h4>
                <i className='file-delete-icon-container'>
                    <BsThreeDots
                        onClick={onDelete}
                        className='file-delete-icon'
                    />
                </i>
            </div>
        </div>
    );
};

export default FileItem;
import React, { useEffect } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import useAPI from '../../../hooks/useAPI';
import { deleteFolder, listFolders } from '../../../services/api';
import FileItem from '../../molecules/FileItem';
import Loader from '../../atoms/Loader';
import EditorWidget from '../EditorWidget';
import './FileManager.css';

interface FileManagerProps {
    onFileSelect: (folderId: string) => void;
    selectedFile: string | null;
    refreshTrigger?: number;
}

const FileManager: React.FC<FileManagerProps> = ({
    onFileSelect,
    selectedFile,
    refreshTrigger = 0
}) => {
    const {
        data,
        loading,
        error,
        execute: loadFolders
    } = useAPI<any[]>(listFolders);

    useEffect(() => {
        loadFolders();
    }, [refreshTrigger]);

    const handleDelete = async (folderId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await deleteFolder(folderId);
            loadFolders();
        } catch (err) {
            console.error('Error deleting folder:', err);
        }
    };

    return (
        <EditorWidget className='editor-file-list-container'>
            <div className='editor-floating-header-container'>
                <h3 className='editor-floating-header-title'>
                    Uploaded Folders ({data?.length || 0})
                </h3>
                <IoIosArrowDown className='editor-floating-header-icon' />
            </div>

            <div className='file-list-body-container'>
                {loading ? (
                    <div className='file-list-loading-container'>
                        <Loader scale={0.5} />
                    </div>
                ) : (
                    data?.map(({ folder_id, ...folder_data }) => (
                        <FileItem
                            key={folder_id}
                            folderId={folder_id}
                            isSelected={selectedFile === folder_id}
                            onSelect={() => onFileSelect({ folder_id, ...folder_data })}
                            onDelete={(e) => handleDelete(folder_id, e)}
                        />
                    ))
                )}
            </div>
        </EditorWidget>
    );
};

export default FileManager;
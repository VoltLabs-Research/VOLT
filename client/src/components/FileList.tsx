import React, { useEffect } from 'react';
import useAPI from '../hooks/useAPI';
import { deleteFolder, listFolders } from '../services/api';
import { IoIosArrowDown } from 'react-icons/io';
import { BsThreeDots } from 'react-icons/bs';
import EditorWidget from './EditorWidget';
import Loader from './Loader';

interface FileListProps {
  onFileSelect: (folderId: string) => void;
  selectedFile: string | null;
  refreshTrigger: number;
}

export const FileList: React.FC<FileListProps> = ({
    onFileSelect,
    selectedFile,
    refreshTrigger
}) => {
    const {
        data: folders,
        loading,
        error,
        execute: loadFolders
    } = useAPI<string[]>(listFolders);

    useEffect(() => {
            loadFolders();
    }, [refreshTrigger]);

    const handleDelete = async (folderId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        try{
            await deleteFolder(folderId);
            loadFolders();
        }catch(err){
            console.error('Error deleting folder:', err);
        }
    };

  return (
        <EditorWidget className='editor-file-list-container'>
            <div className='editor-floating-header-container'>
                <h3 className='editor-floating-header-title'>
                    Uploaded Folders ({folders?.length})
                </h3>
                <IoIosArrowDown className='editor-floating-header-icon' />
            </div>

            <div className='file-list-body-container'>
                {(loading) ? (
                    <div className='file-list-loading-container'>
                        <Loader scale={0.5} />
                    </div>
                ) : (
                    folders?.map((folderId) => (
                        <div
                            key={folderId}
                            className={`file-item ${selectedFile === folderId ? 'selected' : ''}`}
                            onClick={() => onFileSelect(folderId)}
                        >
                            <div className='file-header-container'>
                                <h4>{folderId}</h4>
                                <i className='file-delete-icon-container'>
                                    <BsThreeDots
                                        onClick={(e) => handleDelete(folderId, e)}
                                        className='file-delete-icon'
                                    />
                                </i>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </EditorWidget>
    );
};
import React, { useEffect } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import FileItem from '../../molecules/FileItem';
import Loader from '../../atoms/Loader';
import EditorWidget from '../EditorWidget';
import useTrajectoryStore from '../../../stores/trajectories';
import './FileManager.css';

interface FileManagerProps {
    onFileSelect: (folderId: string) => void;
    selectedFile: string | null;
    refreshTrigger?: number;
}

// TODO: Change component name to "Trajectories" or related. FileManager is not appropiated.
const FileManager: React.FC<FileManagerProps> = ({
    onFileSelect,
    selectedFile,
}) => {
    const { getTrajectories, deleteTrajectory, isLoading, trajectories, error } = useTrajectoryStore();

    useEffect(() => {
        getTrajectories();
    }, []);

    const handleDelete = async (folderId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try{
            await deleteTrajectory(folderId);
        }catch(err){
            console.error('Error deleting folder:', err);
        }
    };

    return (
        <EditorWidget className='editor-file-list-container'>
            <div className='editor-floating-header-container'>
                <h3 className='editor-floating-header-title'>
                    Uploaded Folders ({trajectories?.length || 0})
                </h3>
                <IoIosArrowDown className='editor-floating-header-icon' />
            </div>

            <div className='file-list-body-container'>
                {isLoading ? (
                    <div className='file-list-loading-container'>
                        <Loader scale={0.5} />
                    </div>
                ) : (
                    trajectories?.map(({ folderId, ...data }) => (
                        <FileItem
                            key={folderId}
                            folderId={folderId}
                            isSelected={selectedFile === folderId}
                            onSelect={() => onFileSelect({ folderId, ...data })}
                            onDelete={(e) => handleDelete(folderId, e)}
                        />
                    ))
                )}
            </div>
        </EditorWidget>
    );
};

export default FileManager;
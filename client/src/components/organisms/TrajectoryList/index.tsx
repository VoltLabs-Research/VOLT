import React, { useEffect } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import FileItem from '../../molecules/FileItem';
import Loader from '../../atoms/Loader';
import EditorWidget from '../EditorWidget';
import useTrajectoryStore from '../../../stores/trajectories';
import './TrajectoryList.css';

interface FileManagerProps {
    onFileSelect: (folderId: string) => void;
}

const TrajectoryList: React.FC<FileManagerProps> = ({ onFileSelect }) => {
    const getTrajectories = useTrajectoryStore((state) => state.getTrajectories);
    const deleteTrajectoryById = useTrajectoryStore((state) => state.deleteTrajectoryById);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const selectedTrajectoryId = useTrajectoryStore(state => state.trajectory?._id); 

    useEffect(() => {
        if(!trajectories.length){
            getTrajectories();
        }
    }, []);


    const handleDelete = async (trajectoryId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try{
            await deleteTrajectoryById(trajectoryId);
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
                    trajectories?.map((data) => (
                        <FileItem
                            /* TODO: (folderId === trajectoryId) != data._id */
                            key={data.folderId}
                            data={data}
                            isSelected={selectedTrajectoryId === data.folderId}
                            onSelect={() => onFileSelect(data)}
                            onDelete={(e) => handleDelete(data._id, e)}
                        />
                    ))
                )}
            </div>
        </EditorWidget>
    );
};

export default TrajectoryList;
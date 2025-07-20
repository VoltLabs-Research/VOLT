/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import React, { useEffect } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import FileItem from '@/components/molecules/FileItem';
import Loader from '@/components/atoms/Loader';
import EditorWidget from '@/components/organisms/EditorWidget';
import useTrajectoryStore from '@/stores/trajectories';
import './TrajectoryList.css';

interface TrajectoryListProps {
    onFileSelect: (folderId: string) => void;
}

const TrajectoryList: React.FC<TrajectoryListProps> = ({ onFileSelect }) => {
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
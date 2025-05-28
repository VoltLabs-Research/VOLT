import React, { useEffect } from 'react';
import useAPI from '../hooks/useAPI';
import { deleteFile, listFiles } from '../services/api';
import type { FileInfo } from '../types/index';
import { IoIosArrowDown } from 'react-icons/io';
import { BsThreeDots } from "react-icons/bs";
import EditorWidget from './EditorWidget';

interface FileListProps {
    onFileSelect: (file: FileInfo) => void;
    selectedFile?: FileInfo;
    refreshTrigger?: number;
}

export const FileList: React.FC<FileListProps> = ({ 
    onFileSelect, 
    selectedFile, 
    refreshTrigger
}) => {
    const { data: filesData, loading, error, execute } = useAPI<{ files: FileInfo[] }>();

    useEffect(() => {
        execute(() => listFiles());
    }, [execute, refreshTrigger]);

    const handleDelete = async (fileId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        
        if(!window.confirm(`¿Estás seguro de que quieres eliminar este archivo?`)) {
            return;
        }

        try {
            await deleteFile(fileId);
            execute(() => listFiles());
        }catch(error){
            console.error('Error eliminando archivo:', error);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if(bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if(loading) return <div className="loading">Cargando archivos...</div>;
    if(error) return <div className="error">Error: {error}</div>;

    const files = filesData?.files || [];

    return (
        <EditorWidget className='editor-file-list-container'>
            <div className='editor-floating-header-container'>
                <h3 className='editor-floating-header-title'>Uploaded Files ({files.length})</h3>
                <IoIosArrowDown className='editor-floating-header-icon' />
            </div>

            <div className='file-list-body-container'>
                {files.map((file) => (
                    <div
                        key={file.file_id}
                        className={`file-item ${selectedFile?.file_id === file.file_id ? 'selected' : ''}`}
                        onClick={() => onFileSelect(file)}
                    >
                        <div className='file-header-container'>
                            <h4>{file.filename}</h4>
                            <i className='file-delete-icon-container'>
                                <BsThreeDots onClick={handleDelete} className='file-delete-icon' />
                            </i>
                        </div>
                        <div className='file-details'>
                            <span>{formatFileSize(file.size)}</span>
                            <span>{file.atoms_count.toLocaleString()} atoms</span>
                            <span>{file.total_timesteps} timesteps</span>
                        </div>
                    </div>
                ))}
            </div>
        </EditorWidget>
    );
};
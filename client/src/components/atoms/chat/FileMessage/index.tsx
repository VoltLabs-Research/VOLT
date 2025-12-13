import React, { useEffect, useState } from 'react';
import { IoImageOutline, IoDocumentOutline, IoDownloadOutline } from 'react-icons/io5';
import type { Message } from '@/types/chat';
import { formatSize } from '@/utilities/scene-utils';
import { chatApi } from '@/services/api/chat';

type FileMessageProps = {
    msg: Message,
    currentChatId?: string;
};

const FileMessage: React.FC<FileMessageProps> = ({ msg, currentChatId }: FileMessageProps) => {
    const meta = msg.metadata!;
    const isImage = meta.fileType?.startsWith('image/');
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if(!isImage || !currentChatId) return;
        
        let cancelled = false;
        const run = async () => {
            try{
                const res = await chatApi.getFilePreview(currentChatId, msg._id);
                if(!cancelled){
                    setPreview(res.dataUrl);
                }
            }catch(error: any){
                const errorContext = {
                    endpoint: `/chat/${currentChatId}/files/${msg._id}`,
                    method: 'GET',
                    chatId: currentChatId,
                    messageId: msg._id,
                    operation: 'getFilePreview',
                    statusCode: error?.context?.statusCode,
                    serverMessage: error?.context?.serverMessage,
                    timestamp: new Date().toISOString()
                };
                console.error('Failed to load file preview:', errorContext);
            }
        };

        run();

        return () => {
            cancelled = true;
        }
    }, [isImage, currentChatId, msg._id]);

    if(isImage){
        return (
            <div className='chat-image-message'>
                {preview ? (
                    <img src={preview} alt={meta.fileName} className='chat-image-preview' />
                ) : (
                    <div className='chat-image-loading'>
                        <IoImageOutline />
                    </div>
                )}
                <div className='chat-file-info'>
                    <div className='chat-file-icon'>
                        <IoImageOutline />
                    </div>
                    <div className='chat-file-details'>
                        <p className='chat-file-name'>{meta.fileName}</p>
                        <p className='chat-file-size'>{formatSize(meta.fileSize ?? 0)}</p>
                    </div>
                    <a href={meta.fileUrl} download={meta.fileName} className='chat-file-download'><IoDownloadOutline/></a>
                </div>
            </div>
        );
    }

    return (
        <div className='chat-file-info'>
            <div className='chat-file-icon'><IoDocumentOutline /></div>
            <div className='chat-file-details'>
                <p className='chat-file-name'>{meta.fileName}</p>
                <p className='chat-file-size'>{formatSize(meta.fileSize ?? 0)}</p>
            </div>
            <a href={meta.fileUrl} download={meta.fileName} className='chat-file-download'><IoDownloadOutline/></a>
        </div>
    );
};

export default FileMessage;
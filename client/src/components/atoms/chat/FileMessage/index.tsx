import React, { useEffect, useState } from 'react';
import { IoImageOutline, IoDocumentOutline, IoDownloadOutline } from 'react-icons/io5';
import type { Message } from '@/types/chat';
import { formatSize } from '@/utilities/scene-utils';
import { chatApi } from '@/services/api/chat';
import Paragraph from '@/components/primitives/Paragraph';
import './FileMessage.css';

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
        const run = async() => {
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
            <div className='d-flex column gap-05'>
                {preview ? (
                    <img src={preview} alt={meta.fileName} className='chat-image-preview cursor-pointer' />
                ) : (
                    <div className='d-flex flex-center chat-image-loading w-max font-size-6 color-secondary'>
                        <IoImageOutline />
                    </div>
                )}
                <div className='d-flex items-center gap-075 chat-file-info'>
                    <div className='d-flex flex-center chat-file-icon color-secondary'>
                        <IoImageOutline />
                    </div>
                    <div className='chat-file-details flex-1'>
                        <Paragraph className='chat-file-name overflow-hidden font-weight-6 color-primary'>{meta.fileName}</Paragraph>
                        <Paragraph className='chat-file-size color-muted'>{formatSize(meta.fileSize ?? 0)}</Paragraph>
                    </div>
                    <a href={meta.fileUrl} download={meta.fileName} className='chat-file-download font-size-3 color-muted'><IoDownloadOutline /></a>
                </div>
            </div>
        );
    }

    return (
        <div className='d-flex items-center gap-075 chat-file-info'>
            <div className='d-flex flex-center chat-file-icon color-secondary'><IoDocumentOutline /></div>
            <div className='chat-file-details flex-1'>
                <Paragraph className='chat-file-name overflow-hidden font-weight-6 color-primary'>{meta.fileName}</Paragraph>
                <Paragraph className='chat-file-size color-muted'>{formatSize(meta.fileSize ?? 0)}</Paragraph>
            </div>
            <a href={meta.fileUrl} download={meta.fileName} className='chat-file-download font-size-3 color-muted'><IoDownloadOutline /></a>
        </div>
    );
};

export default FileMessage;

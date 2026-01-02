import React, { useEffect } from 'react';
import { IoImageOutline, IoDocumentOutline, IoDownloadOutline } from 'react-icons/io5';
import type { Message } from '@/types/chat';
import { formatSize } from '@/utilities/glb/scene-utils';
import { formatDistanceToNow } from 'date-fns';
import { chatApi } from '@/services/api/chat/chat';
import './SharedFilesList.css';

type SharedFilesListProps = {
    messages: Message[];
    currentChatId: string
};

const SharedFilesList = ({ messages, currentChatId }: SharedFilesListProps) => {
    const fileMessages = messages.filter(m => m.messageType === 'file' && m.metadata && !m.deleted);
    const [previews, setPreviews] = React.useState<Record<string, string>>({});

    useEffect(() => {
        let cancelled = false;

        const run = async() => {
            for(const m of fileMessages){
                const isImg = m.metadata?.fileType?.startsWith('image/');
                if(!isImg || previews[m._id]) continue;
                try{
                    const p = await chatApi.getFilePreview(currentChatId, m._id);
                    if(!cancelled) setPreviews(prev => ({ ...prev, [m._id]: p.dataUrl }));
                }catch(error: any){
                    console.error('Failed to load file preview:', error);
                }
            }
        }

        run();
        return () => { cancelled = true; };
    }, [fileMessages.map(f => f._id).join(','), currentChatId]);
    if(!fileMessages.length)
        return (
            <div className='chat-empty-state h-max text-center color-secondary'>
                <div className='chat-empty-description font-size-2-5 line-height-5'>No shared files yet</div>
            </div>
        );

    return (
        <div className='d-flex column gap-075 chat-shared-files y-auto'>
            {fileMessages.map((m) => {
                const isImg = m.metadata?.fileType?.startsWith('image/');
                return (
                    <div key={m._id} className='d-flex items-center gap-075 chat-shared-file-item'>
                        {isImg ? (
                            <div className='chat-shared-file-preview overflow-hidden f-shrink-0'>
                                {previews[m._id] ? (
                                    <img src={previews[m._id]} alt={m.metadata?.fileName} className='chat-shared-file-image w-max h-max' />
                                ) : (
                                    <div className='d-flex flex-center chat-shared-file-loading w-max h-max font-size-4 color-secondary'>
                                        <IoImageOutline />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className='d-flex flex-center chat-shared-file-icon f-shrink-0 font-size-4'>
                                <IoDocumentOutline />
                            </div>
                        )}
                        <div className='chat-shared-file-info flex-1'>
                            <div className='chat-shared-file-name overflow-hidden font-size-2 font-weight-5 color-primary'>{m.metadata?.fileName || m.content}</div>
                            <div className='d-flex items-center gap-05 chat-shared-file-meta font-size-1 color-secondary'>
                                <span className='chat-shared-file-size font-weight-5'>{formatSize(m.metadata?.fileSize ?? 0)}</span>
                                <span className='chat-shared-file-date'>{formatDistanceToNow(m.createdAt, { addSuffix: true })}</span>
                            </div>
                        </div>
                        <a
                            href={m.metadata?.fileUrl}
                            download={m.metadata?.fileName}
                            className='d-flex flex-center chat-shared-file-download color-secondary'
                            title='Download file'
                        >
                            <IoDownloadOutline />
                        </a>
                    </div>
                );
            })}
        </div>
    );
}

export default SharedFilesList;

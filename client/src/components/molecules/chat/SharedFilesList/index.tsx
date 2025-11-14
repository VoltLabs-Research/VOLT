import React, { useEffect } from 'react';
import { IoImageOutline, IoDocumentOutline, IoDownloadOutline } from 'react-icons/io5';
import type { Message } from '@/types/chat';
import { formatSize } from '@/utilities/scene-utils';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import { chatApi } from '@/services/chat-api';

type SharedFilesListProps = {
    messages: Message[];
    currentChatId: string
};

const SharedFilesList = ({ messages, currentChatId }: SharedFilesListProps) => {
    const fileMessages = messages.filter(m => m.messageType === 'file' && m.metadata && !m.deleted);
    const [previews, setPreviews] = React.useState<Record<string, string>>({});

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            for (const m of fileMessages) {
                const isImg = m.metadata?.fileType?.startsWith('image/');
                if (!isImg || previews[m._id]) continue;
                    try {
                    const p = await chatApi.getFilePreview(currentChatId, m._id);
                    if (!cancelled) setPreviews(prev => ({ ...prev, [m._id]: p.dataUrl }));
                } catch (error: any) {
                    const errorContext = {
                        endpoint: `/chat/${currentChatId}/files/${m._id}`,
                        method: 'GET',
                        chatId: currentChatId,
                        messageId: m._id,
                        operation: 'getFilePreview',
                        statusCode: error?.context?.statusCode,
                        serverMessage: error?.context?.serverMessage,
                        timestamp: new Date().toISOString()
                    };
                    console.error('Failed to load file preview:', errorContext);
                }
            }
        }

        run();
        return () => { cancelled = true; };
    }, [fileMessages.map(f => f._id).join(','), currentChatId]);
    if (!fileMessages.length)
        return (
            <div className='chat-empty-state'>
                <div className='chat-empty-description'>No shared files yet</div>
            </div>
        );

    return (
        <div className='chat-shared-files'>
            {fileMessages.map((m) => {
                const isImg = m.metadata?.fileType?.startsWith('image/');
                return (
                    <div key={m._id} className='chat-shared-file-item'>
                        {isImg ? (
                            <div className='chat-shared-file-preview'>
                                {previews[m._id] ? (
                                    <img src={previews[m._id]} alt={m.metadata?.fileName} className='chat-shared-file-image' />
                                ) : (
                                    <div className='chat-shared-file-loading'>
                                        <IoImageOutline />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className='chat-shared-file-icon'>
                                <IoDocumentOutline />
                            </div>
                        )}
                        <div className='chat-shared-file-info'>
                            <div className='chat-shared-file-name'>{m.metadata?.fileName || m.content}</div>
                            <div className='chat-shared-file-meta'>
                                <span className='chat-shared-file-size'>{formatSize(m.metadata?.fileSize ?? 0)}</span>
                                <span className='chat-shared-file-date'>{formatTimeAgo(m.createdAt)}</span>
                            </div>
                        </div>
                        <a
                            href={m.metadata?.fileUrl}
                            download={m.metadata?.fileName}
                            className='chat-shared-file-download'
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
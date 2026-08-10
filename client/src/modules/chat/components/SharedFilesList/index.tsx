import { ChatMessageType } from '@volt/contracts/modules/chat/domain';
import { formatDistanceToNow } from 'date-fns';
import FileAttachment from '@/shared/ui/components/FileAttachment';
import type { ChatMessage } from '@volt/contracts/modules/chat/domain';

interface SharedFilesListProps {
    messages: ChatMessage[];
}

const SharedFilesList = ({ messages }: SharedFilesListProps) => {
    const fileMessages = messages.filter(
        (message) => message.messageType === ChatMessageType.File && message.metadata && !message.deleted
    );

    if (fileMessages.length === 0) {
        return (
            <div className='flex p-8 text-center items-center justify-center'>
                <p className='text-sm text-muted'>No shared files yet</p>
            </div>
        );
    }

    return (
        <div className='flex flex-col gap-1 overflow-y-auto max-h-[300px]'>
            {fileMessages.map((message) => (
                <FileAttachment
                    key={message._id}
                    fileName={message.metadata?.fileName}
                    fileSize={message.metadata?.fileSize}
                    fileUrl={message.metadata?.fileUrl}
                    fileType={message.metadata?.fileType}
                    showDownload
                    showPreview
                    variant='detailed'
                    timestamp={formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                />
            ))}
        </div>
    );
};

export default SharedFilesList;

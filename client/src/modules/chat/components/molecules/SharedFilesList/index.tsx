import { formatDistanceToNow } from 'date-fns';
import type { ChatMessage } from '@/modules/chat/api/entities/chat-message';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import FileAttachment from '@/shared/presentation/components/FileAttachment';
import './SharedFilesList.css';

interface SharedFilesListProps {
    messages: ChatMessage[];
};

const SharedFilesList = ({ messages }: SharedFilesListProps) => {
    const fileMessages = messages.filter(
        (m) => m.messageType === 'file' && m.metadata && !m.deleted
    );

    if (fileMessages.length === 0) {
        return (
            <Container className='d-flex flex-center p-2 text-center'>
                <Paragraph className='font-size-2 color-muted'>No shared files yet</Paragraph>
            </Container>
        );
    }

    return (
        <Container className='d-flex column gap-025 y-auto shared-files-list'>
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
                    className='shared-file-item'
                />
            ))}
        </Container>
    );
};

export default SharedFilesList;

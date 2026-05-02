import { ChatMessageType } from '@/modules/chat/api/entities/message';
import { formatDistanceToNow } from 'date-fns';
import FileAttachment from '@/shared/presentation/components/FileAttachment';
import Box from '@/shared/presentation/primitives/Box';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import type { ChatMessage } from '@/modules/chat/api/entities/message';
import './SharedFilesList.css';

interface SharedFilesListProps {
    messages: ChatMessage[];
}

const SharedFilesList = ({ messages }: SharedFilesListProps) => {
    const fileMessages = messages.filter(
        (message) => message.messageType === ChatMessageType.File && message.metadata && !message.deleted
    );

    if (fileMessages.length === 0) {
        return (
            <Box display='flex' p='2' textAlign='center' className='flex-center'>
                <Text as='p' size='md' tone='muted'>No shared files yet</Text>
            </Box>
        );
    }

    return (
        <Stack gap='025' overflow='y-auto' className='shared-files-list'>
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
        </Stack>
    );
};

export default SharedFilesList;

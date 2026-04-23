import { Stack, Box } from '@/shared/presentation/primitives';
import './MessageListSkeleton.css';
interface MessageListSkeletonProps {
    count?: number;
};

const MessageListSkeleton = ({ count = 5 }: MessageListSkeletonProps) => (
    <Stack gap='1'>
        {Array.from({ length: count }).map((_, i) => (
            <Stack key={i} gap='025' className={`message-skeleton ${i % 3 === 0 ? 'sent' : 'received'}`}>
                <Box className='message-skeleton-line' style={{ width: '80%' }} />
                <Box className='message-skeleton-line' style={{ width: '60%' }} />
            </Stack>
        ))}
    </Stack>
);

export default MessageListSkeleton;

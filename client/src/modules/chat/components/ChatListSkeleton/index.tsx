import { Stack, Row, Box } from '@/shared/presentation/primitives';
import './ChatListSkeleton.css';
interface ChatListSkeletonProps {
    count?: number;
};

const ChatListSkeleton = ({ count = 5 }: ChatListSkeletonProps) => (
    <Stack gap='05'>
        {Array.from({ length: count }).map((_, i) => (
            <Row key={i} gap='075' className='chat-skeleton-item'>
                <Box className='chat-skeleton-avatar' />
                <Stack gap='025' flex='1'>
                    <Box className='chat-skeleton-line chat-skeleton-line-wide' />
                    <Box className='chat-skeleton-line chat-skeleton-line-narrow' />
                </Stack>
                <Box className='chat-skeleton-dot' />
            </Row>
        ))}
    </Stack>
);

export default ChatListSkeleton;

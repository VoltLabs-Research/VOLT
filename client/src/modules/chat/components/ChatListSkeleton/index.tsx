import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Skeleton from '@/shared/presentation/primitives/Skeleton';
import './ChatListSkeleton.css';
interface ChatListSkeletonProps {
    count?: number;
}

const ChatListSkeleton = ({ count = 5 }: ChatListSkeletonProps) => (
    <Stack gap='05'>
        {Array.from({ length: count }).map((_, i) => (
            <Row key={i} gap='075' className='chat-skeleton-item'>
                <Skeleton variant='circular' width={40} height={40} />
                <Stack gap='025' flex='1'>
                    <Skeleton variant='rounded' width={120} height={14} />
                    <Skeleton variant='rounded' width={80} height={12} />
                </Stack>
                <Skeleton variant='circular' width={8} height={8} />
            </Row>
        ))}
    </Stack>
);

export default ChatListSkeleton;

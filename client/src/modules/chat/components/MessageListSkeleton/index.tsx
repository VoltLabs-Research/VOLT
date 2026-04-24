import Stack from '@/shared/presentation/primitives/Stack';
import Skeleton from '@/shared/presentation/primitives/Skeleton';
import './MessageListSkeleton.css';
interface MessageListSkeletonProps {
    count?: number;
};

const MessageListSkeleton = ({ count = 5 }: MessageListSkeletonProps) => (
    <Stack gap='1'>
        {Array.from({ length: count }).map((_, i) => (
            <Stack key={i} gap='025' className={`message-skeleton ${i % 3 === 0 ? 'sent' : 'received'}`}>
                <Skeleton variant='rounded' width='80%' height='1rem' />
                <Skeleton variant='rounded' width='60%' height='1rem' />
            </Stack>
        ))}
    </Stack>
);

export default MessageListSkeleton;

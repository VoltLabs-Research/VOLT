import Container from '@/shared/presentation/components/Container';
import './MessageListSkeleton.css';

interface MessageListSkeletonProps {
    count?: number;
};

const MessageListSkeleton = ({ count = 5 }: MessageListSkeletonProps) => (
    <Container className='d-flex column gap-1'>
        {Array.from({ length: count }).map((_, i) => (
            <Container
                key={i}
                className={`d-flex column gap-025 message-skeleton ${i % 3 === 0 ? 'sent' : 'received'}`}
            >
                <Container className='message-skeleton-line' style={{ width: '80%' }} />
                <Container className='message-skeleton-line' style={{ width: '60%' }} />
            </Container>
        ))}
    </Container>
);

export default MessageListSkeleton;

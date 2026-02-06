import Container from '@/shared/presentation/components/Container';
import './ChatListSkeleton.css';

interface ChatListSkeletonProps {
    count?: number;
};

const ChatListSkeleton = ({ count = 5 }: ChatListSkeletonProps) => (
    <Container className='d-flex column gap-05'>
        {Array.from({ length: count }).map((_, i) => (
            <Container key={i} className='d-flex items-center gap-075 chat-skeleton-item'>
                <Container className='chat-skeleton-avatar' />
                <Container className='d-flex column gap-025 flex-1'>
                    <Container className='chat-skeleton-line chat-skeleton-line-wide' />
                    <Container className='chat-skeleton-line chat-skeleton-line-narrow' />
                </Container>
                <Container className='chat-skeleton-dot' />
            </Container>
        ))}
    </Container>
);

export default ChatListSkeleton;

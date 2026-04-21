import './ChatListSkeleton.css';
interface ChatListSkeletonProps {
    count?: number;
};

const ChatListSkeleton = ({ count = 5 }: ChatListSkeletonProps) => (
    <div className='volt-container d-flex column gap-05'>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className='volt-container d-flex items-center gap-075 chat-skeleton-item'>
                <div className='volt-container chat-skeleton-avatar' />
                <div className='volt-container d-flex column gap-025 flex-1'>
                    <div className='volt-container chat-skeleton-line chat-skeleton-line-wide' />
                    <div className='volt-container chat-skeleton-line chat-skeleton-line-narrow' />
                </div>
                <div className='volt-container chat-skeleton-dot' />
            </div>
        ))}
    </div>
);

export default ChatListSkeleton;

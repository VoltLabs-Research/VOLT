import './MessageListSkeleton.css';
interface MessageListSkeletonProps {
    count?: number;
};

const MessageListSkeleton = ({ count = 5 }: MessageListSkeletonProps) => (
    <div className='volt-container d-flex column gap-1'>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className={`volt-container d-flex column gap-025 message-skeleton ${i % 3 === 0 ? 'sent' : 'received'}`}>
                <div className='volt-container message-skeleton-line' style={{ width: '80%' }} />
                <div className='volt-container message-skeleton-line' style={{ width: '60%' }} />
            </div>
        ))}
    </div>
);

export default MessageListSkeleton;

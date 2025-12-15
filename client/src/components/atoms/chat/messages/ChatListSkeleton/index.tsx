import { Skeleton } from '@mui/material';
import './ChatListSkeleton.css';

const ChatListSkeleton = () => (
    <div className='d-flex items-center gap-075 chat-skeleton-list-item'>
        <Skeleton
            variant="circular"
            width={40}
            height={40}
            sx={{
                backgroundColor: 'var(--color-surface-3)',
                '&::after': {
                    background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                }
            }}
        />
        <div className='d-flex column gap-025 chat-skeleton-list-info'>
            <Skeleton
                variant="text"
                width={120}
                height={16}
                sx={{
                    backgroundColor: 'var(--color-surface-3)',
                    '&::after': {
                        background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                    }
                }}
            />
            <Skeleton
                variant="text"
                width={80}
                height={12}
                sx={{
                    backgroundColor: 'var(--color-surface-3)',
                    '&::after': {
                        background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                    }
                }}
            />
        </div>
        <Skeleton
            variant="circular"
            width={8}
            height={8}
            sx={{
                backgroundColor: 'var(--color-surface-3)',
                '&::after': {
                    background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                }
            }}
        />
    </div>
);

export default ChatListSkeleton;

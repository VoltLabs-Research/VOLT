import { Skeleton } from '@mui/material';

const MessageSkeleton = ({ isSent }: { isSent: boolean }) => (
    <div className={`chat-message ${isSent ? 'sent' : 'received'}`}>
        <div className='chat-message-content'>
            <Skeleton 
                variant="rectangular" 
                width={Math.random() * 200 + 100} 
                height={20} 
                sx={{ 
                    borderRadius: 2, 
                    mb: 1,
                    backgroundColor: 'var(--color-surface-3)',
                    '&::after': {
                        background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                    }
                }}
            />
            <div className='chat-message-controls'>
                <Skeleton 
                    variant="circular" 
                    width={24} 
                    height={24}
                    sx={{ 
                        backgroundColor: 'var(--color-surface-3)',
                        '&::after': {
                            background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                        }
                    }}
                />
                {isSent && (
                    <Skeleton 
                        variant="circular" 
                        width={24} 
                        height={24}
                        sx={{ 
                            backgroundColor: 'var(--color-surface-3)',
                            '&::after': {
                                background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                            }
                        }}
                    />
                )}
            </div>
        </div>
    </div>
);

export default MessageSkeleton;
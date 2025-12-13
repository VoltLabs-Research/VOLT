import { Skeleton } from '@mui/material';

const ContactInfoSkeleton = () => (
    <div className='chat-contact-info'>
        <div className='chat-contact-header'>
            <Skeleton
                variant="circular"
                width={48}
                height={48}
                sx={{
                    backgroundColor: 'var(--color-surface-3)',
                    '&::after': {
                        background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                    }
                }}
            />
            <div className='chat-contact-details'>
                <Skeleton
                    variant="text"
                    width={150}
                    height={20}
                    sx={{
                        backgroundColor: 'var(--color-surface-3)',
                        '&::after': {
                            background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                        }
                    }}
                />
                <Skeleton
                    variant="text"
                    width={100}
                    height={14}
                    sx={{
                        backgroundColor: 'var(--color-surface-3)',
                        '&::after': {
                            background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                        }
                    }}
                />
            </div>
        </div>
        <div className='chat-contact-actions'>
            <Skeleton
                variant="rectangular"
                width={32}
                height={32}
                sx={{
                    borderRadius: 1,
                    backgroundColor: 'var(--color-surface-3)',
                    '&::after': {
                        background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                    }
                }}
            />
            <Skeleton
                variant="rectangular"
                width={32}
                height={32}
                sx={{
                    borderRadius: 1,
                    backgroundColor: 'var(--color-surface-3)',
                    '&::after': {
                        background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                    }
                }}
            />
        </div>
    </div>
);

export default ContactInfoSkeleton;

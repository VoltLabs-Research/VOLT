import { Skeleton } from '@mui/material';

const FilePreviewSkeleton = () => (
    <div className='chat-shared-file-item'>
        <Skeleton
            variant="rectangular"
            width={56}
            height={56}
            sx={{
                borderRadius: 1,
                backgroundColor: 'var(--color-surface-3)',
                '&::after': {
                    background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                }
            }}
        />
        <div className='chat-shared-file-info'>
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
            width={24}
            height={24}
            sx={{
                backgroundColor: 'var(--color-surface-3)',
                '&::after': {
                    background: 'linear-gradient(90deg, transparent, var(--color-surface-4), transparent)'
                }
            }}
        />
    </div>
);

export default FilePreviewSkeleton;

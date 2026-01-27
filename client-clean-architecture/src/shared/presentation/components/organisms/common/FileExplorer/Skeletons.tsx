import { Skeleton, Box } from '@mui/material';

export const BreadcrumbsSkeleton = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: .8 }}>
        {Array.from({ length: 3 }).map((_, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center' }}>
                <Skeleton variant="text" width={60 + i * 20} height={18} />
                {i < 2 && <Box component="span" sx={{ mx: .6, fontSize: 12 }}>/</Box>}
            </Box>
        ))}
    </Box>
);

export const HeaderIconSkeleton = () => (
    <Skeleton variant="circular" width={24} height={24} />
);

export const FileRowSkeleton = () => (
    <div className='file-explorer-list-row items-center'>
        <div className='d-flex items-center gap-05 file-explorer-list-column file-explorer-list-name-container'>
            <Skeleton variant="circular" width={18} height={18} />
            <Skeleton variant="text" width="60%" height={18} />
        </div>
        <div className='file-explorer-list-column'>
            <Skeleton variant="text" width="70%" height={18} />
        </div>
        <div className='file-explorer-list-column'>
            <Skeleton variant="text" width="50%" height={18} />
        </div>
        <div className='file-explorer-list-column'>
            <Skeleton variant="text" width="80%" height={18} />
        </div>
    </div>
);

export const TrajectoryItemSkeleton = () => (
    <div className='file-explorer-nav-item'>
        <Skeleton variant="text" width="80%" height={18} />
    </div>
);

import { Skeleton } from '@heroui/react';

const SKELETON_ROWS = 4;

// The shape of a trajectory's row: its name over its summary.
const JobSkeleton = () => (
    <div className='flex flex-col'>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div className='flex flex-col gap-1.5 px-2.5 py-2.5' key={index}>
                <Skeleton className='h-3 w-[60%] rounded-md' />
                <Skeleton className='h-2.5 w-[35%] rounded-md' />
            </div>
        ))}
    </div>
);

export default JobSkeleton;

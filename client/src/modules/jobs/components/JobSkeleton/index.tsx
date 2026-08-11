import { Skeleton } from '@heroui/react';
interface JobSkeletonProps {
    n?: number;
};

const JobSkeleton = ({ n = 10 }: JobSkeletonProps) => (
    <div className='flex flex-col'>
        {Array.from({ length: n }, (_, index) => (
            <div className='flex flex-row items-center justify-between py-3' key={index}>
                <div className='flex flex-row items-center gap-4 flex-1'>
                    <Skeleton className='size-[30px] shrink-0 rounded-full' />
                    <div className='flex-1 min-w-0'>
                        <Skeleton className='h-3 w-[70%] rounded-sm mb-1' />
                        <Skeleton className='h-2.5 w-[100px] rounded-sm' />
                    </div>
                </div>
                <div className='flex flex-col items-center gap-1'>
                    <Skeleton className='h-[18px] w-[60px] rounded-xl' />
                </div>
            </div>
        ))}
    </div>
);

export default JobSkeleton;

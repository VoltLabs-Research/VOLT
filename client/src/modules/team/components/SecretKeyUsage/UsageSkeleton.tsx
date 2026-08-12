import { Skeleton } from '@heroui/react';

const CHART_SKELETON_KEYS = ['hourly', 'endpoints', 'status-codes', 'recent'];
const CARD_SKELETON_KEYS = ['requests', 'response-time', 'success-rate', 'last-used'];

const UsageSkeleton = () => (
    <div className='h-full overflow-scroll text-foreground'>
        <div className='flex flex-col gap-8 w-full max-w-[1600px] mx-auto md:py-4 md:px-8 min-[1440px]:px-12'>
            <div className='flex flex-row items-center gap-4'>
                <Skeleton className='size-6 rounded-full' />
                <Skeleton className='h-8 w-[300px] rounded-md' />
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                {CARD_SKELETON_KEYS.map((key) => (
                    <div className='border border-border p-5 rounded-xl transition-[all] duration-200 ease-out-fluid hover:bg-surface-hover hover:shadow-overlay' key={key}>
                        <Skeleton className='h-4 w-[100px] rounded-md' />
                        <Skeleton className='mt-2 h-10 w-20 rounded-sm' />
                    </div>
                ))}
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6 min-[1440px]:gap-8'>
                {CHART_SKELETON_KEYS.map((key) => (
                    <Skeleton key={key} className='h-[300px] w-full rounded-lg' />
                ))}
            </div>
        </div>
    </div>
);

export default UsageSkeleton;

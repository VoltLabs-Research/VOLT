import { Skeleton } from '@heroui/react';
import Scrollable from '@/shared/ui/components/Scrollable';

const CHART_SKELETON_KEYS = ['hourly', 'endpoints', 'status-codes', 'recent'];
const CARD_SKELETON_KEYS = ['requests', 'response-time', 'success-rate', 'last-used'];

const UsageSkeleton = () => (
    <Scrollable className='h-full text-foreground'>
        <div className='flex flex-col gap-8 w-full max-w-[1600px] mx-auto p-4 md:px-8 min-[1440px]:px-12'>
            <div className='flex flex-row items-center gap-4'>
                <Skeleton className='h-8 w-20 rounded-full' />
                <Skeleton className='h-8 w-75 rounded-full' />
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                {CARD_SKELETON_KEYS.map((key) => (
                    <div className='flex flex-col gap-3 rounded-2xl bg-foreground/4 p-6 max-md:p-5' key={key}>
                        <Skeleton className='h-4 w-25 rounded-full' />
                        <Skeleton className='h-10 w-20 rounded-full' />
                    </div>
                ))}
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6 min-[1440px]:gap-8'>
                {CHART_SKELETON_KEYS.map((key) => (
                    <Skeleton key={key} className='h-[300px] w-full rounded-2xl' />
                ))}
            </div>
        </div>
    </Scrollable>
);

export default UsageSkeleton;

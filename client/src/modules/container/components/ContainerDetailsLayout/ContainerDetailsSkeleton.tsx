import { Skeleton } from '@heroui/react';

const ContainerDetailsSkeleton = () => (
    <div className='flex flex-col h-full min-h-0'>
        <div className='flex flex-col border-b border-border px-6 pt-4 max-[720px]:px-4 max-[720px]:pt-3'>
            <Skeleton animationType='pulse' className='mb-2 h-6 w-[60px] rounded-md' />
            <div className='flex flex-row items-start justify-between gap-4'>
                <div className='flex flex-col gap-2'>
                    <Skeleton animationType='pulse' className='h-7 w-[220px] rounded-md' />
                    <Skeleton animationType='pulse' className='h-[18px] w-[320px] rounded-md' />
                </div>
                <div className='flex flex-row items-center gap-2'>
                    <Skeleton animationType='pulse' className='h-8 w-24 rounded-xl' />
                    <Skeleton animationType='pulse' className='h-8 w-24 rounded-xl' />
                </div>
            </div>
            <div className='my-6'>
                <Skeleton animationType='pulse' className='h-[30px] w-[320px] rounded-xl' />
            </div>
        </div>
        <div className='flex flex-col gap-6 p-6 overflow-auto flex-1 min-h-0 min-w-0'>
            <div className='flex flex-row items-center gap-8'>
                <Skeleton animationType='pulse' className='h-[140px] w-1/3 rounded-xl' />
                <Skeleton animationType='pulse' className='h-[140px] w-1/3 rounded-xl' />
                <Skeleton animationType='pulse' className='h-[140px] w-1/3 rounded-xl' />
            </div>
            <Skeleton animationType='pulse' className='h-60 w-full rounded-xl' />
        </div>
    </div>
);

export default ContainerDetailsSkeleton;

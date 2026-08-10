import { Skeleton } from '@voltstack/bravais';

/** Placeholder shown while the container behind the detail route is still loading. */
const ContainerDetailsSkeleton = () => (
    <div className='flex flex-col h-full min-h-0'>
        <div className='flex flex-col container-details-header'>
            <Skeleton variant='text' width={60} height={24} style={{ marginBottom: 8 }} />
            <div className='flex flex-row items-start justify-between' style={{ gap: '1rem' }}>
                <div className='flex flex-col gap-2'>
                    <Skeleton variant='text' width={220} height={28} />
                    <Skeleton variant='text' width={320} height={18} />
                </div>
                <div className='flex flex-row items-center gap-2'>
                    <Skeleton variant='rounded' width={96} height={32} />
                    <Skeleton variant='rounded' width={96} height={32} />
                </div>
            </div>
            <div className='container-details-header-tabs-row'>
                <Skeleton variant='rounded' width={320} height={30} />
            </div>
        </div>
        <div className='flex flex-col gap-6 p-6 overflow-auto flex-1 min-h-0 min-w-0'>
            <div className='flex flex-row items-center gap-8'>
                <Skeleton variant='rounded' width='33%' height={140} />
                <Skeleton variant='rounded' width='33%' height={140} />
                <Skeleton variant='rounded' width='33%' height={140} />
            </div>
            <Skeleton variant='rounded' width='100%' height={240} />
        </div>
    </div>
);

export default ContainerDetailsSkeleton;

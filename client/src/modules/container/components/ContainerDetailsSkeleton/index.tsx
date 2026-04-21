import Skeleton from '@/shared/presentation/components/Skeleton';
const ContainerDetailsSkeleton = () => (
    <div className='volt-container container-details-layout d-flex column'>
        <div className='volt-container container-details-header d-flex column'>
            <Skeleton variant='text' width={60} height={24} style={{ marginBottom: 8 }} />
            <div className='volt-container d-flex content-between items-start' style={{ gap: '1rem' }}>
                <div className='volt-container d-flex column gap-05'>
                    <Skeleton variant='text' width={220} height={28} />
                    <Skeleton variant='text' width={320} height={18} />
                </div>
                <div className='volt-container d-flex gap-05'>
                    <Skeleton variant='rounded' width={96} height={32} />
                    <Skeleton variant='rounded' width={96} height={32} />
                </div>
            </div>
            <div className='volt-container container-details-header-tabs-row'>
                <Skeleton variant='rounded' width={320} height={30} />
            </div>
        </div>

        <div className='volt-container container-details-content-area flex-1 p-1-5 d-flex column gap-1-5'>
            <div className='volt-container d-flex gap-2'>
                <Skeleton variant='rounded' width='33%' height={140} />
                <Skeleton variant='rounded' width='33%' height={140} />
                <Skeleton variant='rounded' width='33%' height={140} />
            </div>
            <Skeleton variant='rounded' width='100%' height={240} />
        </div>
    </div>
);

export default ContainerDetailsSkeleton;

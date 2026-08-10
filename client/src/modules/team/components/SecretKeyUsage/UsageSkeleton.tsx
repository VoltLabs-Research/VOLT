import { Skeleton } from '@voltstack/bravais';

const UsageSkeleton = () => (
    <div className='h-dvh secret-key-page text-foreground'>
        <div className='flex flex-col gap-8 w-full secret-key-page-main'>
            <div className='flex flex-row items-center gap-4'>
                <Skeleton variant='circular' width={24} height={24} />
                <Skeleton variant='text' width={300} height={32} />
            </div>
            <div className='gap-4 secret-key-page-cards'>
                {[...Array(4)].map((_, index) => (
                    <div className='rounded-2xl transition-[all] duration-200 ease-out-fluid secret-key-page-card' key={index}>
                        <Skeleton variant='text' width={100} height={16} />
                        <Skeleton variant='rectangular' width={80} height={40} style={{
                            borderRadius: 4,
                            marginTop: '0.5rem'
                        }} />
                    </div>
                ))}
            </div>
            <div className='secret-key-page-charts'>
                {[...Array(4)].map((_, index) => (
                    <Skeleton key={index} variant='rectangular' width='100%' height={300} style={{ borderRadius: 8 }} />
                ))}
            </div>
        </div>
    </div>
);

export default UsageSkeleton;

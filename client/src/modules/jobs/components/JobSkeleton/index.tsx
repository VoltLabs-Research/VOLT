import Skeleton from '@/shared/presentation/primitives/Skeleton';
interface JobSkeletonProps {
    n?: number;
};

const JobSkeleton = ({ n = 10 }: JobSkeletonProps) => (
    <div className='d-flex column'>
        {Array.from({ length: n }, (_, index) => (
            <div
                key={index}
                className='d-flex items-center content-between'
                style={{ paddingTop: 12, paddingBottom: 12 }}
            >
                <div className='d-flex items-center gap-1 flex-1'>
                    <Skeleton
                        variant='circular'
                        width={30}
                        height={30}
                        style={{ flexShrink: 0 }}
                    />

                    <div className='flex-1' style={{ minWidth: 0 }}>
                        <Skeleton
                            variant='text'
                            width='70%'
                            height={20}
                            style={{ marginBottom: 4 }}
                        />
                        <Skeleton
                            variant='text'
                            width='100px'
                            height={16}
                        />
                    </div>
                </div>

                <div className='d-flex column items-center gap-025'>
                    <Skeleton
                        variant='rounded'
                        width={60}
                        height={18}
                        style={{ borderRadius: 12 }}
                    />
                </div>
            </div>
        ))}
    </div>
);

export default JobSkeleton;

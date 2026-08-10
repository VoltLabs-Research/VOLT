import { Skeleton } from '@voltstack/bravais';
interface JobSkeletonProps {
    n?: number;
};

const JobSkeleton = ({ n = 10 }: JobSkeletonProps) => (
    <div className='flex flex-col'>
        {Array.from({ length: n }, (_, index) => (
            <div className='flex flex-row items-center justify-between'
                key={index}
                style={{
                    paddingTop: 12,
                    paddingBottom: 12
                }}
            >
                <div className='flex flex-row items-center gap-4 flex-1'>
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

                <div className='flex flex-col items-center gap-1'>
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

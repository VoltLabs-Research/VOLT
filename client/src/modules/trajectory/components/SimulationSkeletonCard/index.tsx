import { Skeleton } from '@voltstack/bravais';

interface SimulationSkeletonCardProps {
    n?: number;
}

export default function SimulationSkeletonCard({ n = 1 }: SimulationSkeletonCardProps) {
    return (
        <>
            {Array.from({ length: n }).map((_, index) => (
                <div className='relative overflow-hidden w-full cursor-pointer simulation-container loading' key={index}>
                    <Skeleton variant='rounded' width='100%' height={200} />
                </div>
            ))}
        </>
    );
}

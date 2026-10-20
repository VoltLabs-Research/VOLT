import { Skeleton } from '@heroui/react';

interface SimulationSkeletonCardProps {
    n?: number;
}

export default function SimulationSkeletonCard({ n = 1 }: SimulationSkeletonCardProps) {
    return (
        <>
            {Array.from({ length: n }).map((_, index) => (
                <div className='relative overflow-hidden w-full cursor-pointer simulation-container loading' key={index}>
                    <Skeleton className='h-[200px] w-full rounded-xl' />
                </div>
            ))}
        </>
    );
}

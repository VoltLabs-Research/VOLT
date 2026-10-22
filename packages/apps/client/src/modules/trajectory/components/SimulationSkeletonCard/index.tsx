import { Skeleton } from '@heroui/react';

interface SimulationSkeletonCardProps {
    n?: number;
}

export default function SimulationSkeletonCard({ n = 1 }: SimulationSkeletonCardProps) {
    return (
        <>
            {Array.from({ length: n }).map((_, index) => (
                <div className='relative h-64 rounded-3xl border border-border' key={index}>
                    <div className='absolute inset-x-0 bottom-0 flex flex-col gap-1.5 px-4 py-3.5'>
                        <Skeleton className='h-4 w-2/3 rounded-md' />
                        <Skeleton className='h-3.5 w-1/2 rounded-md' />
                    </div>
                </div>
            ))}
        </>
    );
}

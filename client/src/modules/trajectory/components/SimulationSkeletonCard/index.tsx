import { Skeleton } from '@heroui/react';

interface SimulationSkeletonCardProps {
    n?: number;
}

/**
 * bravais's `variant='rounded'` was `var(--radius-md)` — 12px — which is HeroUI's
 * `rounded-xl`, not its `rounded-md` (spec §3b).
 */
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

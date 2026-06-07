import { Box, Skeleton } from '@voltstack/bravais';

interface SimulationSkeletonCardProps {
    n?: number;
}

export default function SimulationSkeletonCard({ n = 1 }: SimulationSkeletonCardProps) {
    return (
        <>
            {Array.from({ length: n }).map((_, index) => (
                <Box position='relative' width='max' overflow='hidden' cursor='pointer' className='simulation-container loading' key={index}>
                    <Skeleton variant='rounded' width='100%' height={200} />
                </Box>
            ))}
        </>
    );
}

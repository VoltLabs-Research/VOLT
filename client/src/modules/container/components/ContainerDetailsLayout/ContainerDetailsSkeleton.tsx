import { Skeleton } from '@heroui/react';

/**
 * Placeholder shown while the container behind the detail route is still loading.
 *
 * Two conversions worth naming. The header block used to borrow
 * `.container-details-header` / `.container-details-header-tabs-row` from
 * `ContainerDetailsHeader.css` across a component boundary; those classes are gone,
 * so the padding, bottom rule and tab-row margin are restated here to keep the
 * skeleton the same shape as the header it stands in for.
 *
 * And bravais's `Skeleton` took `variant`/`width`/`height` props where HeroUI's is
 * sized by `className`. The radii carry over by pixel value, not by name:
 * `variant='text'` was 6px (`rounded-md`) and `variant='rounded'` was 12px
 * (`rounded-xl`). `animationType='pulse'` restates bravais's default, since
 * HeroUI's is a shimmer.
 */
const HEADER_CLASS_NAMES = 'flex flex-col border-b border-border px-6 pt-4 max-[720px]:px-4 max-[720px]:pt-3';

const ContainerDetailsSkeleton = () => (
    <div className='flex flex-col h-full min-h-0'>
        <div className={HEADER_CLASS_NAMES}>
            <Skeleton animationType='pulse' className='mb-2 h-6 w-[60px] rounded-md' />
            <div className='flex flex-row items-start justify-between gap-4'>
                <div className='flex flex-col gap-2'>
                    <Skeleton animationType='pulse' className='h-7 w-[220px] rounded-md' />
                    <Skeleton animationType='pulse' className='h-[18px] w-[320px] rounded-md' />
                </div>
                <div className='flex flex-row items-center gap-2'>
                    <Skeleton animationType='pulse' className='h-8 w-24 rounded-xl' />
                    <Skeleton animationType='pulse' className='h-8 w-24 rounded-xl' />
                </div>
            </div>
            <div className='my-6'>
                <Skeleton animationType='pulse' className='h-[30px] w-[320px] rounded-xl' />
            </div>
        </div>
        <div className='flex flex-col gap-6 p-6 overflow-auto flex-1 min-h-0 min-w-0'>
            <div className='flex flex-row items-center gap-8'>
                <Skeleton animationType='pulse' className='h-[140px] w-1/3 rounded-xl' />
                <Skeleton animationType='pulse' className='h-[140px] w-1/3 rounded-xl' />
                <Skeleton animationType='pulse' className='h-[140px] w-1/3 rounded-xl' />
            </div>
            <Skeleton animationType='pulse' className='h-60 w-full rounded-xl' />
        </div>
    </div>
);

export default ContainerDetailsSkeleton;

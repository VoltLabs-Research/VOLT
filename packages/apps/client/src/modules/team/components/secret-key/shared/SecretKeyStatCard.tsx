import type { ReactNode } from 'react';

interface SecretKeyStatCardProps {
    label: ReactNode;
    value?: ReactNode;
    unit?: ReactNode;
}

const SecretKeyStatCard = ({
    label,
    value,
    unit
}: SecretKeyStatCardProps) => {
    return (
        <div className='flex min-w-0 flex-col gap-3 rounded-2xl bg-foreground/4 p-6 max-md:p-5'>
            <span className='text-2xs font-semibold uppercase tracking-[0.05em] leading-none text-muted'>
                {label}
            </span>
            <div className='flex flex-row items-baseline gap-2 tabular-nums'>
                {value !== undefined && value !== null && (
                    <span className='text-3xl font-semibold leading-[1.15] text-foreground max-md:text-2xl'>
                        {value}
                    </span>
                )}
                {unit && (
                    <span className='text-base text-muted'>
                        {unit}
                    </span>
                )}
            </div>
        </div>
    );
};

export default SecretKeyStatCard;

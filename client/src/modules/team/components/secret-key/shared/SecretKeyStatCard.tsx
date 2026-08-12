import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

interface SecretKeyStatCardProps {
    label: ReactNode;
    value?: ReactNode;
    unit?: ReactNode;
    icon?: ReactNode;
    className?: string;
}

const SecretKeyStatCard = ({
    label,
    value,
    unit,
    icon,
    className
}: SecretKeyStatCardProps) => {
    return (
        <div className={cn('flex flex-col gap-3 p-6 rounded-xl border border-border', className)}>
            <div className='flex flex-row items-center gap-2'>
                {icon && (
                    <span className='inline-flex items-center justify-center shrink-0 text-muted' aria-hidden='true'>
                        {icon}
                    </span>
                )}
                <span className='text-2xs font-semibold uppercase tracking-[0.05em] leading-none text-muted'>
                    {label}
                </span>
            </div>
            <div className='flex flex-row items-baseline gap-2 tabular-nums'>
                {value !== undefined && value !== null && (
                    <span className='text-3xl font-semibold leading-[1.15] text-foreground'>
                        {value}
                    </span>
                )}
                {unit && (
                    <span className='text-sm leading-[1.15] text-muted'>
                        {unit}
                    </span>
                )}
            </div>
        </div>
    );
};

export default SecretKeyStatCard;

import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

interface SecretKeyStatCardProps {
    label: ReactNode;
    value?: ReactNode;
    unit?: ReactNode;
    icon?: ReactNode;
    className?: string;
}

/**
 * bravais's `StatCard` in the one configuration the secret-key pages used it in:
 * `icon` + `label` + `value` + optional `unit`, `tone='neutral'`, `surface='soft'`,
 * `tabular` on, `state='ready'`.
 *
 * Restated as a plain element plus utilities (migration spec §4c), converting by value:
 *
 *   root      `Stack gap='075'` → `flex flex-col gap-3`, plus `border border-soft`
 *             (`border-border`), `--radius-md` 12px (`rounded-xl`) and `p-6`.
 *   label     `.text-eyebrow` — 0.7rem / 600 / uppercase / 0.05em / `--color-text-muted`,
 *             with `line-height: 1`. Losing that one composite would change every stat
 *             label's casing, so it is spelled out.
 *   icon      `.volt-stat-card__icon` is `--color-text-muted`; `tone` only ever tinted
 *             this element, and every call site here is the default `neutral`.
 *   value row `Row gap='05'` + `items-baseline` + `tabular-nums`. bravais emitted both
 *             `items-center` and `items-baseline` because its `cn` had no
 *             tailwind-merge; `items-baseline` is the one that was meant.
 *   value     `text-3xl font-semibold` + `--color-text-primary`, `line-height: 1.15`.
 *   unit      bravais's `text-md` is 0.875rem → `text-sm`, muted, same line-height.
 *
 * The `value !== undefined && value !== null` guard is bravais's, so `value={0}` still
 * renders. `className` is passed last into `cn` so a caller's `border`/`bg` wins.
 */
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
                <span className='text-[0.7rem] font-semibold uppercase tracking-[0.05em] leading-none text-muted'>
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

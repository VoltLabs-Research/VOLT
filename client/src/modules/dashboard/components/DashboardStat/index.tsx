import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { DashboardCardDelta } from '@/modules/dashboard/contracts/cards';
import type { ReactNode } from 'react';

interface DashboardStatProps {
    icon: ReactNode;
    name: string;
    /** Abbreviated headline value. */
    value: string;
    delta: DashboardCardDelta;
    /** Names the comparison period: "vs last month", "vs previous 30 days". */
    deltaLabel: string;
    /** Reads under the delta: "8 in the last 30 days". */
    context: string;
}

const DELTA_ICONS = {
    up: ArrowUp,
    down: ArrowDown,
    flat: Minus
};

/*
 * The tile body, shared by every stat card.
 *
 * Two deliberate departures from what this used to do:
 *
 * 1. No sparkline. It sat at 50% opacity behind the number with no axis, no
 *    baseline and no labels, so it could not be read; the readable version of
 *    that shape now lives in the chart below, at a size that fits an axis.
 * 2. The delta is neutral ink, not green/red. Those tokens mean good/bad, and
 *    more trajectories is not a moral improvement — it is just more. The arrow
 *    carries the direction, so nothing here rests on color alone.
 */
const DashboardStat = ({ icon, name, value, delta, deltaLabel, context }: DashboardStatProps) => {
    const DeltaIcon = DELTA_ICONS[delta.direction];

    return (
        <div className='flex h-full flex-col justify-between gap-4 p-4'>
            <div className='flex flex-row items-center gap-2'>
                <span
                    className='inline-flex shrink-0 items-center justify-center text-muted transition-colors duration-200 ease-[ease] group-hover/card:text-foreground'
                    aria-hidden='true'
                >
                    {icon}
                </span>
                <span className='text-sm font-medium'>{name}</span>
            </div>

            <div className='flex flex-col gap-1'>
                <div className='flex flex-row items-end gap-3'>
                    <span className='text-3xl font-semibold leading-none tracking-[-0.02em] text-foreground'>
                        {value}
                    </span>
                    <div className='mb-1 flex flex-row items-center gap-1 text-xs'>
                        {delta.magnitude
                            ? (
                                <>
                                    <DeltaIcon className='text-muted' size={10} aria-hidden='true' />
                                    <span className='font-medium text-foreground'>{delta.magnitude}</span>
                                    <span className='text-muted'>{deltaLabel}</span>
                                </>
                            )
                            /* No arrow when nothing moved — a dash plus the words is one signal too many. */
                            : <span className='text-muted'>{`No change ${deltaLabel}`}</span>}
                    </div>
                </div>
                <span className='text-2xs text-muted'>{context}</span>
            </div>
        </div>
    );
};

export default DashboardStat;

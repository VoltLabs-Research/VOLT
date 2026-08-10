import { Skeleton, cn } from '@heroui/react';
import { formatNetworkSpeedWithUnit } from '@/modules/cluster/utils/format-network';
import { getClusterCpuUsage } from '@/modules/cluster/utils/cluster-cpu-usage';
import { Cpu, MemoryStick, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';
import type { ReactNode } from 'react';

interface MetricsCardsProps {
    metrics: ClusterMetrics | null;
}

interface MetricCardItem {
    icon: ReactNode;
    title: string;
    value: string;
    unit?: string;
    trend: string;
    trendUp: boolean;
    subtitle: string;
}

/** `.metrics-cards` — the grid half of the deleted sheet, in one literal. */
const GRID_CLASS = 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4';

/**
 * bravais's `StatCard` has no HeroUI equivalent (spec §4c: a `<div>` plus utilities),
 * so its own metrics are restated. All of this comes from StatCard.css and the class
 * list the component emitted at `surface='soft'` — the default, and the only one this
 * call site used:
 *
 *   root   `flex flex-col gap-3` + `border border-soft rounded-md` + `p-6`
 *          → `rounded-xl border border-border p-6`, because bravais's `rounded-md` is
 *            12px and 12px is HeroUI's `rounded-xl` (spec §3b)
 *   label  `.text-eyebrow`: `font-size:.7rem; font-weight:600; text-transform:
 *          uppercase; letter-spacing:.05em; color:var(--color-text-muted)`, plus
 *          `line-height:1`. This composite is the most visible thing a token-only
 *          swap drops — without it every stat label changes case.
 *   icon   `.volt-stat-card__icon { color: var(--color-text-muted) }`. `tone` tinted
 *          nothing but the icon and no card here passes one, so the base applies.
 *   value  `text-3xl font-semibold` at bravais's 2rem (stock `text-3xl` is 1.875rem,
 *          spec §3c) plus `line-height:1.15`
 *   unit   `text-md text-muted` → `text-sm text-muted`, same 1.15 leading
 *   footer `padding-top:.25rem`
 *
 * The value row emitted both `items-center` (Row's default align) and
 * `items-baseline`, with the winner decided by sheet order rather than by the string.
 * `items-baseline` is the one that was meant — it is what sits a unit against a 2rem
 * number — so it is the one kept.
 */
const CARD_CLASS = 'flex flex-col gap-3 rounded-xl border border-border p-6';

const CARD_LABEL_CLASS = 'text-[0.7rem] font-semibold uppercase tracking-[0.05em] leading-none text-muted';

const CARD_VALUE_CLASS = 'text-3xl font-semibold leading-[1.15] text-foreground';

const CARD_UNIT_CLASS = 'text-sm leading-[1.15] text-muted';

/**
 * The loading card was one `variant='text'` Skeleton at `width='60%' height={28}`,
 * and `.volt-skeleton--text` applied `transform: scale(1, .6)` even to an explicit
 * height — so it painted about 17px, not 28. `h-[17px]` keeps what was on screen
 * rather than what was in the prop. Its radius was `--radius-xs` (6px) →
 * `rounded-md`, and bravais's default animation was `pulse`, not HeroUI's shimmer.
 *
 * The label slot stays in the tree as an empty span: the loading card passed
 * `label=''`, so it reserved the eyebrow's line box, and dropping it would make the
 * skeleton jump when real data arrives.
 */
const CARD_SKELETON_CLASS = 'h-[17px] w-[60%] rounded-md';

const LOADING_CARD_KEYS = ['metric-card-0', 'metric-card-1', 'metric-card-2', 'metric-card-3'];

const MetricsCards = ({ metrics }: MetricsCardsProps) => {
    if(!metrics){
        return (
            <div className={GRID_CLASS}>
                {LOADING_CARD_KEYS.map((key) => (
                    <div className={CARD_CLASS} key={key}>
                        <div className='flex flex-row items-center gap-2'>
                            <span className={CARD_LABEL_CLASS} />
                        </div>
                        <Skeleton animationType='pulse' className={CARD_SKELETON_CLASS} />
                    </div>
                ))}
            </div>
        );
    }

    const cpuUsage = getClusterCpuUsage(metrics.cpu);
    const networkTotal = metrics.network.incoming + metrics.network.outgoing;
    const networkFormatted = formatNetworkSpeedWithUnit(networkTotal);
    const outgoingFormatted = formatNetworkSpeedWithUnit(metrics.network.outgoing);
    const incomingFormatted = formatNetworkSpeedWithUnit(metrics.network.incoming);
    const cards: MetricCardItem[] = [
        {
            icon: <Cpu size={16} />,
            title: 'CPU Load',
            value: `${cpuUsage.toFixed(1)}%`,
            trend: `${metrics.cpu.cores} cores`,
            trendUp: metrics.cpu.usage < 75,
            subtitle: `Load: ${metrics.cpu.loadAvg[0].toFixed(2)}`
        },
        {
            icon: <MemoryStick size={16} />,
            title: 'Memory Usage',
            value: `${metrics.memory.usagePercent}%`,
            trend: `${metrics.memory.used.toFixed(1)}GB / ${metrics.memory.total.toFixed(1)}GB`,
            trendUp: metrics.memory.usagePercent < 75,
            subtitle: `Free: ${metrics.memory.free.toFixed(1)}GB`
        },
        {
            icon: <Activity size={16} />,
            title: 'Network Traffic',
            value: networkFormatted.value,
            unit: networkFormatted.unit,
            trend: `↑${outgoingFormatted.value} ↓${incomingFormatted.value} ${outgoingFormatted.unit}`,
            trendUp: true,
            subtitle: 'Total Traffic'
        }
    ];

    return (
        <div className={GRID_CLASS}>
            {cards.map((card) => (
                <div className={CARD_CLASS} key={card.title}>
                    <div className='flex flex-row items-center gap-2'>
                        <span className='text-muted' aria-hidden='true'>{card.icon}</span>
                        <span className={CARD_LABEL_CLASS}>{card.title}</span>
                    </div>

                    <div className='flex flex-row items-baseline gap-2 tabular-nums'>
                        <span className={CARD_VALUE_CLASS}>{card.value}</span>
                        {card.unit && <span className={CARD_UNIT_CLASS}>{card.unit}</span>}
                    </div>

                    <div className='pt-1'>
                        <div className='flex flex-row items-center justify-between gap-2'>
                            <span className='text-xs text-muted'>{card.subtitle}</span>
                            {/*
                              * `.metric-card-trend-positive` / `-negative` were
                              * `--status-success` / `--status-error`, which are HeroUI's
                              * `--success` and `--danger`. `.volt-stat-card__trend` pinned
                              * `inline-flex`, `font-size:.75rem` and `font-weight:500` over
                              * whatever the caller set, so `text-xs font-medium` is what
                              * actually rendered here.
                              */}
                            <span className={cn('inline-flex flex-row items-center gap-1 text-xs font-medium', card.trendUp ? 'text-success' : 'text-danger')}>
                                {card.trendUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {card.trend}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MetricsCards;

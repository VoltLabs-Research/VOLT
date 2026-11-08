import Sparkline from '@/modules/analysis/components/charts/Sparkline';
import CompositionBar from '@/modules/analysis/components/charts/CompositionBar';
import useRunHeadline from '@/modules/analysis/components/AnalysisPage/use-run-headline';
import { formatMetric } from '@/modules/analysis/utils/run-results';
import { AnalysisStatus } from '@/modules/fractal/contracts';
import StatusPill from '@/shared/ui/components/StatusPill';
import { ChevronRight } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { memo, useEffect, useRef, useState } from 'react';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';

interface RunRowProps {
    analysis: Analysis;
    plugin: Plugin | undefined;
    onOpen: (analysisId: string) => void;
}

// Rows fetch their headline once they come near the viewport.
const useNearViewport = <T extends Element>() => {
    const ref = useRef<T>(null);
    const [isNear, setIsNear] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element || isNear) return undefined;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) setIsNear(true);
        }, { rootMargin: '200px' });
        observer.observe(element);
        return () => observer.disconnect();
    }, [isNear]);

    return { ref, isNear };
};

const whenLabel = (analysis: Analysis): string => {
    const date = analysis.finishedAt ?? analysis.createdAt;
    return date ? formatDistanceToNowStrict(new Date(date), { addSuffix: true }) : '';
};

/* One run: method · its headline (chart and value) · when. The whole row opens the run's report. */
const RunRow = ({ analysis, plugin, onOpen }: RunRowProps) => {
    const { ref, isNear } = useNearViewport<HTMLButtonElement>();
    const headline = useRunHeadline(analysis, plugin, isNear);
    const isCompleted = analysis.status === AnalysisStatus.Completed;
    const methodName = analysis.pluginDisplayName || plugin?.modifier?.name || 'Analysis';

    let chart = null;
    let value = null;
    if (headline.kind === 'composition') {
        chart = <CompositionBar parts={headline.parts} />;
        value = (
            <>
                <b className='text-sm font-medium tabular-nums text-foreground'>{headline.lead.value.toFixed(1)}%</b>
                <span className='truncate text-muted'>{headline.lead.label}</span>
            </>
        );
    } else if (headline.kind === 'metric') {
        chart = <Sparkline values={headline.values} className='text-muted' />;
        value = (
            <>
                <b className='text-sm font-medium tabular-nums text-foreground'>{formatMetric(headline.value)}</b>
                <span className='truncate text-muted'>{headline.label}</span>
            </>
        );
    }

    return (
        <button
            ref={ref}
            type='button'
            onClick={() => onOpen(analysis._id)}
            title={`${methodName} · ${analysis.trajectory?.name ?? ''}`}
            className='group grid min-h-10 w-full cursor-pointer grid-cols-[minmax(0,1fr)_88px_minmax(0,200px)_110px] items-center gap-5 border-0 bg-transparent px-4 text-left transition-colors duration-150 hover:bg-foreground/[0.045]'
        >
            <span className='truncate text-sm text-foreground'>{methodName}</span>
            <span className='flex w-[88px] items-center'>{chart}</span>
            <span className='flex min-w-0 items-baseline gap-1.5 overflow-hidden whitespace-nowrap text-xs'>{value}</span>
            <span className='flex items-center justify-end gap-1.5 whitespace-nowrap text-xs text-muted'>
                {isCompleted ? whenLabel(analysis) : <StatusPill status={analysis.status} />}
                <ChevronRight size={14} className='-mr-1 opacity-0 transition-opacity group-hover:opacity-70' aria-hidden='true' />
            </span>
        </button>
    );
};

export default memo(RunRow);

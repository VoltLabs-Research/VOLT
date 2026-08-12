import { ChevronDown, ChevronRight, Layers, RotateCcw, Scissors, SlidersHorizontal } from 'lucide-react';
import { cn } from '@heroui/react';
import {
    CanvasTreeRow,
    MaybeContextMenu,
    TREE_ROW_CLASS,
    treeIndentClass
} from '../CanvasTree';
import { UNGROUPED_RUN_ID, countRunStagesByKind } from '../../utils/pipeline-run-sections';
import { describePipelineRunStage } from './stage-labels';
import { formatCompactRelativeTime } from '@/shared/utils/format-relative-time';
import { resolveStatusTone, statusDotClass } from '@/shared/ui/components/StatusPill';

import type { ReactNode } from 'react';
import type { CanvasAnalysisStatus } from '../../utils/analysis-status';
import type { MenuOption } from '@/shared/contracts/menu';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';
import type { PipelineRunSection, PipelineRunStageRow } from '../../utils/pipeline-run-sections';

interface PipelineRunTreeNodeProps {
    section: PipelineRunSection;
    isExpanded: boolean;
    onToggle: (runId: string) => void;
    status?: CanvasAnalysisStatus;
    /** Absent when the caller cannot mutate the canvas, which hides the action. */
    onRestore?: (run: PipelineRun) => void;
    /**
     * Renders one analysis stage. A render prop rather than a forwarded prop bag:
     * the parent already wires every `AnalysisTreeNode` prop, and duplicating
     * that list here is how the two row kinds would drift apart.
     */
    renderAnalysisRow: (row: Extract<PipelineRunStageRow, { kind: 'analysis' }>) => ReactNode;
}

const ICON_STYLE = {
    width: 13,
    height: 13
};

const CHEVRON_STYLE = ICON_STYLE;

const STAGE_ICON = {
    slice: Scissors,
    expression: SlidersHorizontal,
    plugin: Layers
} as const;

const CachedBadge = () => (
    <span
        className='shrink-0 rounded-sm bg-surface-tertiary px-1 py-px text-2xs leading-none text-muted'
        title='An identical stage had already run — this run reused its result instead of recomputing.'
    >
        cached
    </span>
);

const PipelineRunTreeNode = ({
    section,
    isExpanded,
    onToggle,
    status,
    onRestore,
    renderAnalysisRow
}: PipelineRunTreeNodeProps) => {
    const { run, rows, isUngrouped } = section;
    const counts = countRunStagesByKind(rows);

    const label = isUngrouped
        ? 'Ungrouped'
        : `Run #${section.ordinal ?? 1}`;

    // Ungrouped rows have no run behind them, so there is no single time to show.
    const timeLabel = isUngrouped || !run
        ? undefined
        : formatCompactRelativeTime(run.createdAt);

    const stageSummary = [
        `${counts.analyses} ${counts.analyses === 1 ? 'stage' : 'stages'}`,
        counts.context > 0 ? `${counts.context} transform${counts.context === 1 ? '' : 's'}` : undefined,
        counts.cached > 0 ? `${counts.cached} cached` : undefined
    ].filter((part): part is string => part !== undefined).join(' · ');

    const menuOptions: MenuOption[] = run && onRestore
        ? [{
            label: 'Restore into pipeline',
            icon: RotateCcw,
            onClick: () => onRestore(run)
        }]
        : [];

    const runRow = (
        <button
            type='button'
            role='treeitem'
            aria-selected={false}
            aria-expanded={isExpanded}
            tabIndex={0}
            onClick={() => onToggle(section.runId)}
            className={cn(
                'flex cursor-pointer select-none items-center gap-2 text-xs',
                TREE_ROW_CLASS,
                treeIndentClass('base'),
                'hover:rounded-md hover:bg-surface-hover'
            )}
        >
            {status !== undefined && (
                <span
                    className={cn('size-1.5 shrink-0 rounded-full', statusDotClass(resolveStatusTone(status)))}
                    aria-hidden='true'
                />
            )}
            <span className='flex min-w-0 flex-[0_1_auto] flex-col gap-px'>
                <span className='truncate font-medium text-foreground'>{label}</span>
                <span className='truncate text-2xs leading-[1.2] text-muted opacity-90'>
                    {timeLabel ? `${timeLabel} · ${stageSummary}` : stageSummary}
                </span>
            </span>
            <span className='flex-1' />
            <span className='flex items-center text-muted' aria-hidden='true'>
                {isExpanded ? <ChevronDown style={CHEVRON_STYLE} /> : <ChevronRight style={CHEVRON_STYLE} />}
            </span>
        </button>
    );

    const renderStageRow = (row: PipelineRunStageRow): ReactNode => {
        if (row.kind === 'analysis') {
            return renderAnalysisRow(row);
        }

        const Icon = STAGE_ICON[row.stage.kind];

        if (row.kind === 'context') {
            return (
                <CanvasTreeRow
                    key={row.key}
                    indent='lg'
                    disabled
                    icon={<Icon style={ICON_STYLE} />}
                    label={<span className='truncate'>{describePipelineRunStage(row.stage)}</span>}
                    ariaLabel={`${describePipelineRunStage(row.stage)} (transform, no results)`}
                />
            );
        }

        return (
            <CanvasTreeRow
                key={row.key}
                indent='lg'
                disabled
                icon={<Icon style={ICON_STYLE} />}
                label={(
                    <span className='flex min-w-0 items-center gap-1.5'>
                        <span className='truncate'>{describePipelineRunStage(row.stage)}</span>
                        {row.stage.cacheHit && <CachedBadge />}
                    </span>
                )}
                ariaLabel={`${describePipelineRunStage(row.stage)} — results not loaded`}
            />
        );
    };

    return (
        <>
            {menuOptions.length > 0 ? (
                <MaybeContextMenu
                    enabled
                    id={`canvas-ctx-pipeline-run-${section.runId}`}
                    options={menuOptions}
                >
                    {runRow}
                </MaybeContextMenu>
            ) : runRow}

            {isExpanded && rows.map(renderStageRow)}
        </>
    );
};

export { UNGROUPED_RUN_ID, CachedBadge };

export default PipelineRunTreeNode;

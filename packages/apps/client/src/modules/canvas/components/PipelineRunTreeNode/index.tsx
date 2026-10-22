import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@heroui/react';
import {
    CanvasTreeRow,
    MaybeContextMenu,
    TREE_ROW_CLASS,
    treeIndentClass
} from '../CanvasTree';
import { CanvasAnalysisStatusEnum } from '../../utils/analysis-status';
import { countRunStagesByKind } from '../../utils/pipeline-run-sections';
import { describePipelineRunStage, resolveRunLabel } from './stage-labels';
import EditableTag from '@/shared/ui/components/EditableTag';
import { formatCompactRelativeTime } from '@/shared/utils/format-relative-time';

import { useState } from 'react';

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
    onRestore?: (run: PipelineRun) => void;
    onRename?: (run: PipelineRun, name: string) => void;
    onDelete?: (run: PipelineRun) => void;
    renderAnalysisRow: (row: Extract<PipelineRunStageRow, { kind: 'analysis' }>) => ReactNode;
}

const ICON_STYLE = {
    width: 13,
    height: 13
};


const CachedBadge = () => (
    <span
        className='shrink-0 rounded-full bg-foreground/[0.06] px-1.5 text-2xs leading-4 text-muted'
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
    onRename,
    onDelete,
    renderAnalysisRow
}: PipelineRunTreeNodeProps) => {
    const { run, rows, isUngrouped } = section;
    const counts = countRunStagesByKind(rows);
    const [isEditingName, setIsEditingName] = useState(false);

    const label = isUngrouped ? 'Ungrouped' : resolveRunLabel(run, rows);

    const timeLabel = isUngrouped || !run
        ? undefined
        : formatCompactRelativeTime(run.createdAt);

    const metaLabel = [
        timeLabel,
        counts.cached > 0 ? `${counts.cached} cached` : undefined,
        status !== undefined && status !== CanvasAnalysisStatusEnum.Completed ? status : undefined
    ].filter((part): part is string => part !== undefined).join(' · ');

    const menuOptions: MenuOption[] = [];
    if (run && onRestore) {
        menuOptions.push({
            label: 'Restore into pipeline',
            onClick: () => onRestore(run)
        });
    }
    if (run && onDelete) {
        menuOptions.push({
            label: 'Delete',
            onClick: () => onDelete(run),
            destructive: true
        });
    }

    const canRename = Boolean(run && onRename);

    const titleClassName = cn('font-medium text-foreground', !isEditingName && 'truncate');

    const title = canRename && run
        ? (
            <EditableTag
                as='span'
                className={titleClassName}
                title={label}
                allowSingleClickPropagation
                allowEmpty
                onEditingChange={setIsEditingName}
                onSave={(next) => onRename?.(run, next)}
            >
                {label}
            </EditableTag>
        )
        : <span className={titleClassName} title={label}>{label}</span>;

    const runRow = (
        <div
            role='treeitem'
            aria-selected={false}
            aria-expanded={isExpanded}
            tabIndex={0}
            onClick={() => onToggle(section.runId)}
            onKeyDown={(event) => {
                if (isEditingName) return;
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onToggle(section.runId);
            }}
            className={cn(
                'flex cursor-pointer select-none items-center gap-2 text-xs',
                TREE_ROW_CLASS,
                treeIndentClass('base'),
                'hover:bg-foreground/5 focus-visible:bg-foreground/[0.06]'
            )}
        >
            <span className='flex min-w-0 flex-[0_1_auto] flex-col gap-px'>
                {title}
                {metaLabel && (
                    <span className='truncate text-xs leading-[1.2] text-muted'>
                        {metaLabel}
                    </span>
                )}
            </span>
            <span className='flex-1' />
            <span className='flex items-center text-muted' aria-hidden='true'>
                {isExpanded ? <ChevronDown style={ICON_STYLE} /> : <ChevronRight style={ICON_STYLE} />}
            </span>
        </div>
    );

    const renderStageRow = (row: PipelineRunStageRow): ReactNode => {
        if (row.kind === 'analysis') {
            return renderAnalysisRow(row);
        }

        if (row.kind === 'context') {
            return (
                <CanvasTreeRow
                    key={row.key}
                    indent='lg'
                    disabled
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

export { CachedBadge };

export default PipelineRunTreeNode;

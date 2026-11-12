import { memo, useEffect, useRef, useState } from 'react';
import PanelRow, { PanelGroupLabel } from './PanelRow';
import EditableTag from '@/shared/ui/components/EditableTag';
import Scrollable from '@/shared/ui/components/Scrollable';
import { formatCompactRelativeTime } from '@/shared/utils/format-relative-time';
import { resolveRunLabel } from '../../utils/pipeline-stage-labels';
import { CanvasAnalysisStatusEnum } from '../../utils/analysis-status';

import type { MenuOption } from '@/shared/contracts/menu';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';
import type { PipelineRunSection } from '../../utils/pipeline-run-sections';
import type { CanvasAnalysisStatus } from '../../utils/analysis-status';
import type { PanelRowTone } from './PanelRow';

export const DRAFT_PIPELINE_ID = 'draft';

interface PipelinesSectionProps {
    runSections: PipelineRunSection[];
    draftStageCount: number;
    selectedId: string;
    // The saved pipeline whose results the viewport shows, when it is not the selected one.
    inViewRunId?: string;
    onSelect: (pipelineId: string) => void;
    resolveRunStatus: (section: PipelineRunSection) => CanvasAnalysisStatus | undefined;
    onDuplicate?: (run: PipelineRun) => void;
    onRename?: (run: PipelineRun, name: string) => void;
    onDelete?: (run: PipelineRun) => void;
    onClearDraft?: () => void;
}

const STATUS_TONE: Partial<Record<CanvasAnalysisStatus, PanelRowTone>> = {
    [CanvasAnalysisStatusEnum.Pending]: 'queued',
    [CanvasAnalysisStatusEnum.Running]: 'running',
    [CanvasAnalysisStatusEnum.Failed]: 'failed'
};

const STATUS_LABEL: Partial<Record<CanvasAnalysisStatus, string>> = {
    [CanvasAnalysisStatusEnum.Pending]: 'Queued',
    [CanvasAnalysisStatusEnum.Running]: 'Running',
    [CanvasAnalysisStatusEnum.Failed]: 'Failed'
};

// The draft and every saved run, like OVITO's pipeline selector: the panel below shows the one chosen here.
const PipelinesSection = ({
    runSections,
    draftStageCount,
    selectedId,
    inViewRunId,
    onSelect,
    resolveRunStatus,
    onDuplicate,
    onRename,
    onDelete,
    onClearDraft
}: PipelinesSectionProps) => {
    const [renamingRunId, setRenamingRunId] = useState<string | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Scroll the chosen pipeline into the list's view, e.g. a run opened from the Analyses listing.
    useEffect(() => {
        const list = listRef.current;
        const row = list?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
        if (!list || !row) return;

        const listBox = list.getBoundingClientRect();
        const rowBox = row.getBoundingClientRect();
        if (rowBox.top < listBox.top) list.scrollTop -= listBox.top - rowBox.top;
        else if (rowBox.bottom > listBox.bottom) list.scrollTop += rowBox.bottom - listBox.bottom;
    }, [selectedId, runSections.length]);

    const draftMenu: MenuOption[] = onClearDraft && draftStageCount > 0
        ? [{ label: 'Clear draft', onClick: onClearDraft, destructive: true }]
        : [];

    return (
        <div className='flex shrink-0 flex-col px-2 pt-2'>
            <PanelGroupLabel>Pipelines</PanelGroupLabel>
            {/* Four rows at most (1.875rem each, 1px apart); longer lists scroll, so the pipeline below keeps its room. */}
            <Scrollable
                ref={listRef}
                className='flex max-h-[7.6875rem] flex-col gap-px'
                role='listbox'
                aria-label='Pipelines'
            >
                <PanelRow
                    id='canvas-pipeline-draft'
                    label='Draft'
                    meta={`${draftStageCount} stage${draftStageCount === 1 ? '' : 's'}`}
                    isSelected={selectedId === DRAFT_PIPELINE_ID}
                    alignWithCheckboxes={false}
                    onSelect={() => onSelect(DRAFT_PIPELINE_ID)}
                    menuOptions={draftMenu}
                />
                {runSections.map((section) => {
                    const { run } = section;
                    const label = section.isUngrouped ? 'Ungrouped' : resolveRunLabel(run, section.rows);
                    const status = resolveRunStatus(section);
                    const meta = (status !== undefined ? STATUS_LABEL[status] : undefined)
                        ?? (section.runId === inViewRunId && section.runId !== selectedId ? 'In view' : undefined)
                        ?? (run ? formatCompactRelativeTime(run.createdAt) : undefined);
                    const rename = run && onRename ? (next: string) => onRename(run, next) : undefined;

                    const menuOptions: MenuOption[] = [];
                    if (run && onDuplicate) menuOptions.push({ label: 'Duplicate into draft', onClick: () => onDuplicate(run) });
                    if (rename) menuOptions.push({ label: 'Rename', onClick: () => setRenamingRunId(section.runId) });
                    if (run && onDelete) menuOptions.push({ label: 'Delete', onClick: () => onDelete(run), destructive: true });

                    return (
                        <PanelRow
                            key={section.runId}
                            id={`canvas-pipeline-${section.runId}`}
                            label={rename && renamingRunId === section.runId ? (
                                // A pill inside the pill row; the ring is drawn inside so the row's truncation can't clip it.
                                <EditableTag
                                    as='span'
                                    className='rounded-full px-1.5 ring-inset'
                                    title={label}
                                    allowEmpty
                                    editing
                                    onEditingChange={(editing) => {
                                        if (!editing) setRenamingRunId(null);
                                    }}
                                    onSave={rename}
                                >
                                    {label}
                                </EditableTag>
                            ) : label}
                            title={label}
                            meta={meta}
                            tone={status === undefined ? undefined : STATUS_TONE[status]}
                            isSelected={selectedId === section.runId}
                            alignWithCheckboxes={false}
                            onSelect={() => onSelect(section.runId)}
                            onDoubleClick={rename ? () => setRenamingRunId(section.runId) : undefined}
                            menuOptions={menuOptions}
                        />
                    );
                })}
            </Scrollable>
            <div className='mx-2.5 mb-2 mt-1.5 h-px shrink-0 bg-foreground/[0.08]' aria-hidden='true' />
        </div>
    );
};

export default memo(PipelinesSection);

import { useState } from 'react';
import { Label, ListBox, Select, cn } from '@heroui/react';
import { TONE_CLASS } from './PanelRow';
import { MaybeContextMenu } from '../CanvasTree';
import EditableTag from '@/shared/ui/components/EditableTag';
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

interface PipelineOption {
    id: string;
    label: string;
    meta?: string;
    tone?: PanelRowTone;
    run?: PipelineRun;
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

// The trigger reads as the panel's title: transparent until hovered, a pill while open.
const TRIGGER_CLASS = 'flex h-8 min-h-8 w-full min-w-0 items-center gap-2 rounded-full border-0 bg-transparent py-0 ps-2.5 text-xs font-medium text-foreground shadow-none';

const PipelineMeta = ({ option }: { option: PipelineOption }) => option.meta === undefined ? null : (
    <span className={cn('shrink-0 text-2xs font-normal tabular-nums text-muted', option.tone && TONE_CLASS[option.tone])}>
        {option.meta}
    </span>
);

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
    const [isRenaming, setIsRenaming] = useState(false);

    const options: PipelineOption[] = [
        {
            id: DRAFT_PIPELINE_ID,
            label: 'Draft',
            meta: `${draftStageCount} stage${draftStageCount === 1 ? '' : 's'}`
        },
        ...runSections.map((section): PipelineOption => {
            const { run } = section;
            const status = resolveRunStatus(section);

            return {
                id: section.runId,
                label: section.isUngrouped ? 'Ungrouped' : resolveRunLabel(run, section.rows),
                meta: (status !== undefined ? STATUS_LABEL[status] : undefined)
                    ?? (section.runId === inViewRunId && section.runId !== selectedId ? 'In view' : undefined)
                    ?? (run ? formatCompactRelativeTime(run.createdAt) : undefined),
                tone: status === undefined ? undefined : STATUS_TONE[status],
                run
            };
        })
    ];
    const selected = options.find((option) => option.id === selectedId) ?? options[0];
    const { run } = selected;

    // Right-clicking the selector acts on the pipeline it shows.
    const menuOptions: MenuOption[] = [];
    if (!run && onClearDraft && draftStageCount > 0) menuOptions.push({ label: 'Clear draft', onClick: onClearDraft, destructive: true });
    if (run && onDuplicate) menuOptions.push({ label: 'Duplicate into draft', onClick: () => onDuplicate(run) });
    if (run && onRename) menuOptions.push({ label: 'Rename', onClick: () => setIsRenaming(true) });
    if (run && onDelete) menuOptions.push({ label: 'Delete', onClick: () => onDelete(run), destructive: true });

    if (isRenaming && run && onRename) {
        return (
            <div className='shrink-0 px-2 pb-1 pt-2'>
                <div className={TRIGGER_CLASS}>
                    <EditableTag
                        as='span'
                        title={selected.label}
                        allowEmpty
                        editing
                        onEditingChange={setIsRenaming}
                        onSave={(next) => onRename(run, next)}
                    >
                        {selected.label}
                    </EditableTag>
                </div>
            </div>
        );
    }

    return (
        <div className='shrink-0 px-2 pb-1 pt-2'>
            <MaybeContextMenu enabled={menuOptions.length > 0} id='canvas-ctx-pipeline' options={menuOptions}>
                <Select
                    aria-label='Pipeline'
                    selectedKey={selected.id}
                    onSelectionChange={(key) => {
                        if (key !== null) onSelect(String(key));
                    }}
                    fullWidth
                    className='min-w-0'
                >
                    <Select.Trigger
                        className={cn(
                            TRIGGER_CLASS,
                            'transition-colors duration-[140ms] hover:bg-foreground/5 aria-expanded:bg-foreground/[0.08]'
                        )}
                    >
                        <Select.Value className='min-w-0 flex-1 truncate text-xs' title={selected.label}>
                            {() => selected.label}
                        </Select.Value>
                        <PipelineMeta option={selected} />
                        <Select.Indicator className='size-3.5 text-muted' />
                    </Select.Trigger>
                    <Select.Popover className='w-(--trigger-width)'>
                        <ListBox>
                            {options.map((option) => (
                                <ListBox.Item
                                    key={option.id}
                                    id={option.id}
                                    textValue={option.label}
                                    className='gap-2 pe-7'
                                >
                                    <ListBox.ItemIndicator />
                                    <Label
                                        className={cn('min-w-0 flex-1 truncate', option.tone && TONE_CLASS[option.tone])}
                                        title={option.label}
                                    >
                                        {option.label}
                                    </Label>
                                    <PipelineMeta option={option} />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
            </MaybeContextMenu>
        </div>
    );
};

export default PipelinesSection;

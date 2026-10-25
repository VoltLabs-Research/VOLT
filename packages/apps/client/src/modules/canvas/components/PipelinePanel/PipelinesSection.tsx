import { useState } from 'react';
import PanelRow, { PanelGroupLabel } from './PanelRow';
import Scrollable from '@/shared/ui/components/Scrollable';
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

// The draft and every saved run, like OVITO's pipeline selector: the list below shows the one chosen here.
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

    const draftMenu: MenuOption[] = onClearDraft && draftStageCount > 0
        ? [{ label: 'Clear draft', onClick: onClearDraft, destructive: true }]
        : [];

    return (
        <Scrollable
            className='mx-2 mb-2 mt-2 flex max-h-40 shrink-0 flex-col gap-px border-b border-foreground/[0.06] pb-2'
            role='listbox'
            aria-label='Pipelines'
        >
            <PanelGroupLabel>Pipelines</PanelGroupLabel>
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
                const tone = status === undefined ? undefined : STATUS_TONE[status];
                const meta = (status !== undefined ? STATUS_LABEL[status] : undefined)
                    ?? (section.runId === inViewRunId && section.runId !== selectedId ? 'In view' : undefined)
                    ?? (run ? formatCompactRelativeTime(run.createdAt) : undefined);
                const isRenaming = renamingRunId === section.runId;

                const menuOptions: MenuOption[] = [];
                if (run && onDuplicate) menuOptions.push({ label: 'Duplicate into draft', onClick: () => onDuplicate(run) });
                if (run && onRename) menuOptions.push({ label: 'Rename', onClick: () => setRenamingRunId(section.runId) });
                if (run && onDelete) menuOptions.push({ label: 'Delete', onClick: () => onDelete(run), destructive: true });

                return (
                    <PanelRow
                        key={section.runId}
                        id={`canvas-pipeline-${section.runId}`}
                        label={run && onRename ? (
                            <EditableTag
                                as='span'
                                className={isRenaming ? undefined : 'truncate'}
                                title={label}
                                allowEmpty
                                editing={isRenaming}
                                onEditingChange={(editing) => setRenamingRunId(editing ? section.runId : null)}
                                onSave={(next) => onRename(run, next)}
                            >
                                {label}
                            </EditableTag>
                        ) : label}
                        title={label}
                        meta={meta}
                        tone={tone}
                        isSelected={selectedId === section.runId}
                        alignWithCheckboxes={false}
                        onSelect={() => onSelect(section.runId)}
                        menuOptions={menuOptions}
                    />
                );
            })}
        </Scrollable>
    );
};

export default PipelinesSection;

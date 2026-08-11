import { CanvasTreeRow } from '../CanvasTree';
import { cn } from '@heroui/react';

import type { AnalysisArtifactStatus, AnalysisExpectedArtifact } from '@volt/contracts/modules/analysis/domain';

interface PendingArtifactRowProps {
    artifact?: AnalysisExpectedArtifact;
    fallbackName: string;
    isRecentlyReady: boolean;
}

/** Why this row is not selectable yet. The row colours by status already; this says it in words. */
const STATUS_TITLE: Record<AnalysisArtifactStatus, string> = {
    pending: 'Waiting for the analysis to reach this model',
    generating: 'This model is still being generated',
    uploading: 'This model is being uploaded',
    ready: 'Ready — loading into the scene list',
    failed: 'This model failed to generate'
};

const PendingArtifactRow = ({ artifact, fallbackName, isRecentlyReady }: PendingArtifactRowProps) => {
    const labelToneClass = {
        pending: '[&>.truncate]:text-warning [[data-theme=light]_&]:[&>.truncate]:text-[#8a5300]',
        generating: '[&>.truncate]:text-accent [[data-theme=light]_&]:[&>.truncate]:text-[#0a5fbf]',
        uploading: '[&>.truncate]:text-accent [[data-theme=light]_&]:[&>.truncate]:text-[#0a5fbf]',
        'ready-recent': '[&>.truncate]:text-success [&>.truncate]:[text-shadow:0_0_10px_color-mix(in_srgb,var(--success)_35%,transparent)] [[data-theme=light]_&]:[&>.truncate]:text-[#0f7a34]',
        failed: '[&>.truncate]:text-danger [[data-theme=light]_&]:[&>.truncate]:text-[#c41e1e]'
    } as const;

    return (
        <CanvasTreeRow
            indent='lg'
            disabled
            label={(
                <span title={artifact ? STATUS_TITLE[artifact.status] : undefined} className={cn(
                    'flex w-full min-w-0 items-center gap-1.5 [&>.truncate]:min-w-0 [&>.truncate]:transition-[color,text-shadow] [&>.truncate]:duration-[180ms]',
                    isRecentlyReady
                        ? labelToneClass['ready-recent']
                        : artifact && artifact.status !== 'ready' && labelToneClass[artifact.status]
                )}>
                    <span className='truncate'>{artifact?.name ?? fallbackName}</span>
                </span>
            )}
        />
    );
};

export default PendingArtifactRow;

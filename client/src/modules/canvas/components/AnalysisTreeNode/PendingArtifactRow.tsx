import { CanvasTreeRow } from '../CanvasTree';
import { cn } from '@heroui/react';

import type { AnalysisArtifactStatus, AnalysisExpectedArtifact } from '@volt/contracts/modules/analysis/domain';

interface PendingArtifactRowProps {
    artifact?: AnalysisExpectedArtifact;
    fallbackName: string;
    isRecentlyReady: boolean;
}

const STATUS_TITLE: Record<AnalysisArtifactStatus, string> = {
    pending: 'Waiting for the analysis to reach this model',
    generating: 'This model is still being generated',
    uploading: 'This model is being uploaded',
    ready: 'Ready — loading into the scene list',
    failed: 'This model failed to generate'
};

const PendingArtifactRow = ({ artifact, fallbackName, isRecentlyReady }: PendingArtifactRowProps) => {
    const labelToneClass = {
        pending: '[&>.truncate]:text-warning-soft-foreground',
        generating: '[&>.truncate]:text-info-soft-foreground',
        uploading: '[&>.truncate]:text-info-soft-foreground',
        'ready-recent': '[&>.truncate]:text-success-soft-foreground [&>.truncate]:[text-shadow:0_0_10px_color-mix(in_srgb,var(--success)_35%,transparent)]',
        failed: '[&>.truncate]:text-danger-soft-foreground'
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

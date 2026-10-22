import EditableTrajectoryName from '../EditableTrajectoryName';
import { cn } from '@heroui/react';
import { formatDistanceToNowStrict } from 'date-fns';

interface SimulationCardFooterProps {
    trajectoryId: string;
    name: string;
    updatedAt: string;
    atoms?: number;
    framesCount: number;
    isProcessing: boolean;
    processingMessage?: string;
    readOnly?: boolean;
}

const buildCaption = (updatedAt: string, atoms: number | undefined, framesCount: number): string => {
    const parts = [`Edited ${formatDistanceToNowStrict(new Date(updatedAt), { addSuffix: true })}`];

    if (atoms) {
        parts.push(`${atoms.toLocaleString()} atoms`);
    }

    if (framesCount) {
        parts.push(`${framesCount.toLocaleString()} ${framesCount === 1 ? 'frame' : 'frames'}`);
    }

    return parts.join(' · ');
};

// The title and caption at the foot of the card, over its preview.
export default function SimulationCardFooter({
    trajectoryId,
    name,
    updatedAt,
    atoms,
    framesCount,
    isProcessing,
    processingMessage,
    readOnly = false
}: SimulationCardFooterProps) {
    const caption = isProcessing ? processingMessage : buildCaption(updatedAt, atoms, framesCount);

    return (
        <div className='absolute inset-x-0 bottom-0 flex min-w-0 flex-col gap-1 px-4 py-3.5'>
            <EditableTrajectoryName
                trajectoryId={trajectoryId}
                name={name}
                className={cn(
                    'line-clamp-2 w-fit max-w-full rounded-lg bg-transparent text-base font-medium leading-snug text-foreground',
                    !readOnly && 'hover:bg-foreground/6 focus-visible:bg-foreground/6'
                )}
                allowSingleClickPropagation
                readOnly={readOnly}
            />
            <p className={cn('truncate text-sm text-muted', isProcessing && 'animate-pulse')} title={caption}>
                {caption}
            </p>
        </div>
    );
}

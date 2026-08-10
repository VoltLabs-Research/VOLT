import { Label, ProgressBar } from '@heroui/react';

interface PreloadingOverlayProps {
    active: boolean;
    title?: string;
    description?: string;
    progress?: number;
}

const PreloadingOverlay = ({
    active,
    title = 'Loading trajectory…',
    description,
    progress
}: PreloadingOverlayProps) => {
    if (!active) return null;

    const hasProgress = progress !== undefined;

    return (
        <div className='flex flex-row items-center justify-center absolute inset-0 bg-overlay z-[1000]'>
            <ProgressBar
                className='w-[min(320px,70%)]'
                size='sm'
                value={hasProgress ? progress * 100 : undefined}
                isIndeterminate={!hasProgress}
            >
                <Label>{description ?? title}</Label>
                {hasProgress && <ProgressBar.Output />}
                <ProgressBar.Track>
                    <ProgressBar.Fill />
                </ProgressBar.Track>
            </ProgressBar>
        </div>
    );
};

export default PreloadingOverlay;

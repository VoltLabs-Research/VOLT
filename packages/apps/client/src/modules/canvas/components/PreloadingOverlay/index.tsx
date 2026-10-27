import { Label, ProgressBar, cn } from '@heroui/react';

interface PreloadingOverlayProps {
    active: boolean;
    title: string;
    detail?: string;
}

// Covers only the viewport, in the scene's own clear colour: the toolbar, panel and timeline are
// usable while the frame loads. It stays mounted so it can fade out over the scene that replaces it.
const PreloadingOverlay = ({ active, title, detail }: PreloadingOverlayProps) => (
    <div
        className={cn(
            'absolute inset-0 z-[15] flex flex-row items-center justify-center bg-white transition-[opacity,visibility] duration-200 ease-out motion-reduce:transition-none dark:bg-canvas',
            !active && 'invisible opacity-0'
        )}
        aria-hidden={!active}
    >
        <ProgressBar className='w-[min(320px,70%)]' size='sm' isIndeterminate aria-label={title}>
            <Label>{title}</Label>
            {detail && <ProgressBar.Output className='font-normal text-muted'>{detail}</ProgressBar.Output>}
            <ProgressBar.Track>
                <ProgressBar.Fill />
            </ProgressBar.Track>
        </ProgressBar>
    </div>
);

export default PreloadingOverlay;

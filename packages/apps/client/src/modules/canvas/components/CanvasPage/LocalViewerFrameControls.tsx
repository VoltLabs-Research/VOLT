import { Button } from '@heroui/react';

import type { ResolvedLocalGlbManifest, ResolvedLocalGlbManifestFrame } from '@/modules/canvas/utils/local-glb-manifest';

interface LocalViewerFrameControlsProps {
    manifest: ResolvedLocalGlbManifest | null;
    frame: ResolvedLocalGlbManifestFrame | null;
    frameIndex: number;
    onSelectFrame: (nextIndex: number) => void;
}

const LocalViewerFrameControls = ({
    manifest,
    frame,
    frameIndex,
    onSelectFrame
}: LocalViewerFrameControlsProps) => {
    if (!manifest || manifest.frames.length <= 1) {
        return null;
    }

    const lastFrameIndex = manifest.frames.length - 1;

    return (
        <div className='absolute bottom-2 left-2 z-20 flex h-auto max-h-[calc(100%-2rem)] min-h-0 w-auto max-w-[min(44rem,calc(100%-1rem))] flex-col overflow-visible rounded-2xl bg-dashboard-surface px-4 py-3 shadow-overlay max-md:inset-x-2 max-md:max-w-none max-md:px-3' id='canvas-center-timeline'>
            <div className='grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3.5 max-md:grid-cols-1 max-md:gap-2.5'>
                <div className='min-w-0'>
                    <div className='truncate text-sm font-semibold text-foreground'>
                        {manifest.title || 'Local scene sequence'}
                    </div>
                    <div className='mt-1 text-xs text-muted'>
                        {frame?.label
                            || (frame?.timestep !== undefined
                                ? `t=${frame.timestep}`
                                : `Frame ${frameIndex + 1}`)}
                    </div>
                </div>
                <div className='flex min-w-[min(22rem,46vw)] items-center gap-2.5 max-md:min-w-0'>
                    <Button
                        variant='outline'
                        size='sm'
                        onPress={() => onSelectFrame(frameIndex - 1)}
                        isDisabled={frameIndex <= 0}
                    >
                        Prev
                    </Button>
                    <input
                        className='w-[min(22rem,46vw)] accent-accent max-md:w-full max-md:min-w-0'
                        type='range'
                        min='0'
                        max={String(lastFrameIndex)}
                        step='1'
                        value={String(frameIndex)}
                        onChange={(event) => onSelectFrame(Number(event.currentTarget.value))}
                        aria-label='Select local scene frame'
                    />
                    <Button
                        variant='outline'
                        size='sm'
                        onPress={() => onSelectFrame(frameIndex + 1)}
                        isDisabled={frameIndex >= lastFrameIndex}
                    >
                        Next
                    </Button>
                </div>
                <div className='min-w-14 text-right text-xs text-muted max-md:text-left'>
                    {frameIndex + 1} / {manifest.frames.length}
                </div>
            </div>
        </div>
    );
};

export default LocalViewerFrameControls;

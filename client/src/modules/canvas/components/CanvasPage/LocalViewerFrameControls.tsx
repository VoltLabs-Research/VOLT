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
        <div className='absolute bottom-0 left-0 right-auto z-20 flex h-auto max-h-[calc(100%-2rem)] min-h-0 flex-col overflow-visible w-auto max-w-[min(44rem,calc(100%-1.5rem))] rounded-tr-[14px] bg-surface-secondary px-4 py-3.5 max-md:pointer-events-none max-md:inset-x-0 max-md:bottom-4 max-md:z-[120] max-md:w-full max-md:max-w-none max-md:rounded-b-xl max-md:rounded-t-none max-md:bg-transparent max-md:px-3.5 max-md:pt-3 max-md:pb-[calc(0.875rem_+_env(safe-area-inset-bottom,0px))]' id='canvas-center-timeline'>
            <div className='grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3.5 max-md:grid-cols-1 max-md:gap-2.5'>
                <div className='min-w-0'>
                    <div className='truncate text-[0.8125rem] font-semibold text-foreground'>
                        {manifest.title || 'Local scene sequence'}
                    </div>
                    <div className='mt-[0.2rem] text-xs text-muted'>
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

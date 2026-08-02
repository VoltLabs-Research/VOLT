import { Button, Stack } from '@voltstack/bravais';

import type { ResolvedLocalGlbManifest, ResolvedLocalGlbManifestFrame } from '@/modules/canvas/utils/local-glb-manifest';

interface LocalViewerFrameControlsProps {
    manifest: ResolvedLocalGlbManifest | null;
    frame: ResolvedLocalGlbManifestFrame | null;
    frameIndex: number;
    onSelectFrame: (nextIndex: number) => void;
}

/** Frame transport for a local GLB sequence, standing in for the trajectory timeline. */
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
        <Stack id='canvas-center-timeline' className='canvas-center-timeline canvas-center-timeline--local'>
            <div className='canvas-local-viewer-controls'>
                <div className='canvas-local-viewer-controls__meta'>
                    <div className='canvas-local-viewer-controls__title'>
                        {manifest.title || 'Local scene sequence'}
                    </div>
                    <div className='canvas-local-viewer-controls__subtitle'>
                        {frame?.label
                            || (frame?.timestep !== undefined
                                ? `t=${frame.timestep}`
                                : `Frame ${frameIndex + 1}`)}
                    </div>
                </div>
                <div className='canvas-local-viewer-controls__transport'>
                    <Button
                        variant='outline'
                        intent='canvas'
                        size='sm'
                        shape='rounded'
                        onClick={() => onSelectFrame(frameIndex - 1)}
                        disabled={frameIndex <= 0}
                    >
                        Prev
                    </Button>
                    <input
                        className='canvas-local-viewer-controls__slider'
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
                        intent='canvas'
                        size='sm'
                        shape='rounded'
                        onClick={() => onSelectFrame(frameIndex + 1)}
                        disabled={frameIndex >= lastFrameIndex}
                    >
                        Next
                    </Button>
                </div>
                <div className='canvas-local-viewer-controls__index'>
                    {frameIndex + 1} / {manifest.frames.length}
                </div>
            </div>
        </Stack>
    );
};

export default LocalViewerFrameControls;

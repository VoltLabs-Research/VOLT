import { Skeleton } from '@heroui/react';

// The board as it opens, framed as WhiteboardCanvas frames Excalidraw: its islands where Excalidraw puts
// them (the main menu top-left, the tools top-center, the collaborators and library top-right, zoom and
// undo bottom-left) over an empty canvas.
const WhiteboardEditorLoader = () => (
    <div
        className='relative h-full w-full overflow-hidden rounded-2xl bg-background'
        role='status'
        aria-live='polite'
        aria-label='Loading whiteboard workspace'
    >
        <Skeleton className='absolute left-4 top-4 size-9 rounded-lg' />
        <Skeleton className='absolute left-1/2 top-4 h-11 w-[min(26rem,calc(100%-8rem))] -translate-x-1/2 rounded-xl max-md:hidden' />
        <Skeleton className='absolute right-4 top-4 h-9 w-28 rounded-lg' />
        <div className='absolute bottom-4 left-4 flex flex-row gap-2'>
            <Skeleton className='h-9 w-28 rounded-lg' />
            <Skeleton className='h-9 w-20 rounded-lg' />
        </div>
    </div>
);

export default WhiteboardEditorLoader;

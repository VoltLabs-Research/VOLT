import { Spinner } from '@heroui/react';

const WhiteboardEditorLoader = () => (
    <div
        className='flex w-full h-full items-center justify-center bg-surface'
        role='status'
        aria-live='polite'
        aria-label='Loading whiteboard workspace'
    >
        <Spinner size='lg' />
    </div>
);

export default WhiteboardEditorLoader;

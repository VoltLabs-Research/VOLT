import Scrollable from '@/shared/ui/components/Scrollable';

import type { ReactNode } from 'react';

interface StageEditorLayoutProps {
    children: ReactNode;

    footer?: ReactNode;
}

const StageEditorLayout = ({ children, footer }: StageEditorLayoutProps) => (
    <div className='flex min-w-0 flex-col gap-2'>
        <Scrollable className='flex max-h-[min(60vh,26rem)] min-h-0 flex-col'>
            <div className='flex flex-col gap-2 pb-px'>
                {children}
            </div>
        </Scrollable>
        {footer && (
            <div className='flex shrink-0 flex-col gap-2'>
                {footer}
            </div>
        )}
    </div>
);

export default StageEditorLayout;

import { Checkbox, cn } from '@heroui/react';
import { MaybeContextMenu } from '../CanvasTree';

import type { DragEvent, ReactNode } from 'react';
import type { MenuOption } from '@/shared/contracts/menu';

export type PanelRowTone = 'queued' | 'running' | 'completed' | 'failed';

const TONE_CLASS: Record<PanelRowTone, string> = {
    queued: 'text-warning-soft-foreground',
    running: 'text-info-soft-foreground',
    completed: 'text-success-soft-foreground',
    failed: 'text-danger-soft-foreground'
};

interface PanelRowCheckbox {
    isSelected: boolean;
    isDisabled?: boolean;
    onChange: (next: boolean) => void;
    ariaLabel: string;
}

export interface PanelRowDrag {
    isDragging: boolean;
    isDropTarget: boolean;
    onDragStart: (event: DragEvent<HTMLDivElement>) => void;
    onDragOver: (event: DragEvent<HTMLDivElement>) => void;
    onDrop: (event: DragEvent<HTMLDivElement>) => void;
    onDragEnd: () => void;
}

interface PanelRowProps {
    id: string;
    label: ReactNode;
    title?: string;
    meta?: ReactNode;
    tone?: PanelRowTone;
    isSelected?: boolean;
    // A switched-off stage: shown, but faded and struck through.
    isOff?: boolean;
    checkbox?: PanelRowCheckbox;
    // Rows without a checkbox keep its width so labels line up.
    alignWithCheckboxes?: boolean;
    onSelect?: () => void;
    menuOptions?: MenuOption[];
    tourTargetId?: string;
    // Set on rows that can be dragged into another place in their list.
    drag?: PanelRowDrag;
}

// One row of the pipeline panel's lists: transparent until hovered, a pill when selected.
const PanelRow = ({
    id,
    label,
    title,
    meta,
    tone,
    isSelected = false,
    isOff = false,
    checkbox,
    alignWithCheckboxes = true,
    onSelect,
    menuOptions,
    tourTargetId,
    drag
}: PanelRowProps) => {
    const row = (
        <div
            id={id}
            role='option'
            aria-selected={isSelected}
            data-tour-id={tourTargetId}
            onClick={onSelect}
            draggable={Boolean(drag)}
            onDragStart={drag?.onDragStart}
            onDragOver={drag?.onDragOver}
            onDrop={drag?.onDrop}
            onDragEnd={drag?.onDragEnd}
            className={cn(
                'flex min-h-[1.875rem] w-full min-w-0 cursor-pointer select-none items-center gap-2 rounded-full px-2.5 text-xs text-muted',
                'transition-[background-color,color,opacity] duration-[140ms] hover:bg-foreground/5',
                isSelected && 'bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.08]',
                drag?.isDragging && 'opacity-50',
                drag?.isDropTarget && 'shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_18%,transparent)]'
            )}
        >
            {checkbox ? (
                <span className='inline-flex shrink-0' onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                        aria-label={checkbox.ariaLabel}
                        isSelected={checkbox.isSelected}
                        isDisabled={checkbox.isDisabled}
                        onChange={checkbox.onChange}
                    >
                        <Checkbox.Control>
                            <Checkbox.Indicator />
                        </Checkbox.Control>
                    </Checkbox>
                </span>
            ) : alignWithCheckboxes && <span className='w-4 shrink-0' aria-hidden='true' />}
            <span
                className={cn(
                    'min-w-0 flex-1 truncate transition-colors duration-[180ms]',
                    tone && TONE_CLASS[tone],
                    isOff && 'line-through decoration-foreground/15 opacity-55'
                )}
                title={title}
            >
                {label}
            </span>
            {meta !== undefined && (
                <span className={cn('shrink-0 text-2xs tabular-nums text-muted', tone && TONE_CLASS[tone])}>{meta}</span>
            )}
        </div>
    );

    if (!menuOptions?.length) return row;

    return (
        <MaybeContextMenu enabled id={`canvas-ctx-${id}`} options={menuOptions}>
            {row}
        </MaybeContextMenu>
    );
};

export const PanelGroupLabel = ({ children }: { children: ReactNode }) => (
    <div className='shrink-0 px-2.5 pb-0.5 pt-2 text-2xs font-medium text-muted first:pt-0.5' role='presentation'>
        {children}
    </div>
);

export default PanelRow;

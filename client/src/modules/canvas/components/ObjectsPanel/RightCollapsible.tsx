import { CollapsibleSection } from '@voltstack/bravais';

import type { ReactNode } from 'react';

const COLLAPSIBLE_PRESET = {
    className: 'canvas-right-dropdown',
    headerClassName: 'canvas-right-dropdown-header d-flex items-center gap-05',
    titleClassName: 'canvas-right-dropdown-title font-size-05 color-muted',
    iconClassName: 'canvas-right-dropdown-icon',
    bodyClassName: 'canvas-right-dropdown-body',
    contentClassName: 'd-flex column',
    noSpacing: true,
    arrowSize: 13,
    useDefaultHeaderStyles: false,
    useDefaultTitleStyles: false
} as const;

export const PANEL_ICON_STYLE = {
    width: 13,
    height: 13,
    color: 'var(--color-text-secondary)'
} as const;

interface RightCollapsibleProps {
    title: string;
    icon?: ReactNode;
    expanded: boolean;
    onExpandedChange?: (next: boolean) => void;
    headerAction?: ReactNode;
    children: ReactNode;
    extraClassName?: string;
    collapsible?: boolean;
    tourId?: string;
}

const RightCollapsible = ({ title, icon, expanded, onExpandedChange, headerAction, children, extraClassName, collapsible = true, tourId }: RightCollapsibleProps) => (
    <div data-tour-id={tourId}>
        <CollapsibleSection
            {...COLLAPSIBLE_PRESET}
            className={`${COLLAPSIBLE_PRESET.className} ${extraClassName ?? ''}`}
            title={title}
            icon={icon}
            expanded={expanded}
            onExpandedChange={onExpandedChange}
            headerAction={headerAction}
            collapsible={collapsible}
        >
            {children}
        </CollapsibleSection>
    </div>
);

export default RightCollapsible;

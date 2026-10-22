import NavItem from '@/shared/ui/components/NavItem';
import SidebarPanel, { SidebarPanelTitle } from '@/shared/ui/components/SidebarPanel';
import { Tooltip } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import type { SidebarPanelName } from '@/shared/ui/components/SidebarPanel';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface SectionNavLink {
    label: string;
    icon?: LucideIcon;
    to: string;
    isActive: boolean;
    // Shown instead of the label's tooltip, and the row is disabled.
    disabledReason?: string;
}

interface SectionNavProps {
    name: SidebarPanelName;
    title: string;
    backLabel?: string;
    backTo: string;
    links: SectionNavLink[];
    active: boolean;
    collapsed: boolean;
}

const renderRow = (key: string, tooltip: string, isTooltipDisabled: boolean, row: ReactNode) => (
    <Tooltip key={key} isDisabled={isTooltipDisabled}>
        <Tooltip.Trigger className='w-full' role='presentation' tabIndex={-1}>
            {row}
        </Tooltip.Trigger>
        <Tooltip.Content placement='right'>{tooltip}</Tooltip.Content>
    </Tooltip>
);

// A section with pages of its own takes over the sidebar, under a way back to where it opened
// from: one sidebar, never a second column.
const SectionNav = ({ name, title, backLabel = 'Go back', backTo, links, active, collapsed }: SectionNavProps) => (
    <SidebarPanel name={name} label={`${title} navigation`} active={active}>
        {renderRow('back', backLabel, !collapsed, (
            <NavItem label={backLabel} icon={ArrowLeft} to={backTo} collapsed={collapsed} />
        ))}

        {!collapsed && <SidebarPanelTitle>{title}</SidebarPanelTitle>}

        {links.map((link) => renderRow(
            link.label,
            link.disabledReason ?? link.label,
            !collapsed && !link.disabledReason,
            (
                <NavItem
                    label={link.label}
                    icon={link.icon}
                    to={link.to}
                    isActive={link.isActive}
                    isDisabled={Boolean(link.disabledReason)}
                    collapsed={collapsed}
                />
            )
        ))}
    </SidebarPanel>
);

export default SectionNav;

import NavItem from '@/shared/ui/components/NavItem';
import { Tooltip } from '@heroui/react';
import { useEffect, useId, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface NavTreeNode {
    label: string;
    to?: string;
    onClick?: () => void;
    isSelected?: boolean;
    children?: NavTreeNode[];
}

interface NavTreeGroupProps {
    node: NavTreeNode;
    collapsed: boolean;
}

const NavTreeGroup = ({ node, collapsed }: NavTreeGroupProps) => {
    const children = node.children ?? [];
    const childSelected = children.some((child) => child.isSelected);
    const [expanded, setExpanded] = useState(childSelected);
    const listId = useId();

    useEffect(() => {
        if (childSelected) {
            setExpanded(true);
        }
    }, [childSelected]);

    return (
        <li className='flex flex-col gap-0.5'>
            <NavItem
                label={node.label}
                depth={1}
                collapsed={collapsed}
                isActive={Boolean(node.isSelected) || childSelected}
                isExpanded={expanded}
                controls={listId}
                onClick={() => setExpanded((value) => !value)}
            />

            {expanded ? (
                <ul id={listId} className='flex flex-col gap-0.5'>
                    {children.map((child) => (
                        <li key={child.label}>
                            <NavItem
                                label={child.label}
                                depth={2}
                                collapsed={collapsed}
                                to={child.to}
                                onClick={child.onClick}
                                isActive={Boolean(child.isSelected)}
                            />
                        </li>
                    ))}
                </ul>
            ) : null}
        </li>
    );
};

interface NavTreeSectionProps {
    label: string;
    icon: LucideIcon;
    isActive: boolean;
    items: NavTreeNode[];
    collapsed: boolean;
    isDisabled?: boolean;

    tooltip: string;
    isTooltipDisabled: boolean;

    onRequestExpand?: () => void;
}

const NavTreeSection = ({
    label,
    icon,
    isActive,
    items,
    collapsed,
    isDisabled = false,
    tooltip,
    isTooltipDisabled,
    onRequestExpand
}: NavTreeSectionProps) => {
    const [expanded, setExpanded] = useState(false);
    const listId = useId();

    useEffect(() => {
        if (isActive) {
            setExpanded(true);
        }
    }, [isActive]);

    const handleToggle = () => {
        const next = !expanded;

        if (next) {
            onRequestExpand?.();
        }

        setExpanded(next);
    };

    return (
        <div className='flex flex-col gap-0.5'>
            <Tooltip isDisabled={isTooltipDisabled}>
                <Tooltip.Trigger className='w-full' role='presentation' tabIndex={-1}>
                    <NavItem
                        label={label}
                        icon={icon}
                        collapsed={collapsed}
                        isActive={isActive}
                        isDisabled={isDisabled}
                        isExpanded={expanded}
                        controls={listId}
                        onClick={handleToggle}
                    />
                </Tooltip.Trigger>
                <Tooltip.Content placement='right'>{tooltip}</Tooltip.Content>
            </Tooltip>

            {expanded && !isDisabled && !collapsed ? (
                <ul id={listId} className='flex flex-col gap-0.5'>
                    {items.map((item) => {
                        if (item.children) {
                            return <NavTreeGroup key={item.label} node={item} collapsed={collapsed} />;
                        }

                        return (
                            <li key={item.label}>
                                <NavItem
                                    label={item.label}
                                    depth={1}
                                    collapsed={collapsed}
                                    to={item.to}
                                    onClick={item.onClick}
                                    isActive={Boolean(item.isSelected)}
                                />
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
};

export default NavTreeSection;

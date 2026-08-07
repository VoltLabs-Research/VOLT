import { Button } from '@voltstack/bravais';
import './SidebarExpandableSection.css';
import './SidebarSubItems.css';
import NestedSubItems from './NestedSubItems';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useState, forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { IconType } from 'react-icons';
import type { SubItem } from '@/shared/contracts/sidebar';

interface SidebarExpandableSectionProps {
    label: string;
    icon: IconType | LucideIcon;
    isActive?: boolean;
    subItems: SubItem[];
    defaultExpanded?: boolean;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    disabled?: boolean;
    onRequestSidebarExpand?: () => void;
};

const SidebarExpandableSection = forwardRef<HTMLDivElement, SidebarExpandableSectionProps>(({
    label,
    icon: Icon,
    isActive = false,
    subItems,
    defaultExpanded = false,
    expanded: controlledExpanded,
    onExpandedChange,
    disabled = false,
    onRequestSidebarExpand
}, ref) => {
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
    const subItemsId = useId();
    
    const isControlled = controlledExpanded !== undefined;
    const expanded = isControlled ? controlledExpanded : internalExpanded;

    const handleToggle = () => {
        if (disabled) return;
        const newExpanded = !expanded;
        if (newExpanded) {
            onRequestSidebarExpand?.();
        }
        if (isControlled) {
            onExpandedChange?.(newExpanded);
        } else {
            setInternalExpanded(newExpanded);
        }
    };

    useEffect(() => {
        if (!isControlled && isActive) {
            setInternalExpanded(true);
        }
    }, [isActive, isControlled]);

    const renderSubItem = (item: SubItem) => {
        const hasChildren = Boolean(item.subItems?.length);

        if (!hasChildren) {
            return (
                <Button
                    variant='ghost'
                    intent='neutral'
                    align='start'
                    className={`sidebar-sub-item transition-fast ${item.isSelected ? 'is-selected' : ''} w-full text-secondary cursor-pointer`}
                    onClick={item.onClick}
                    aria-current={item.isSelected ? 'page' : undefined}
                >
                    <span className="truncate">{item.label}</span>
                </Button>
            );
        }

        const childSelected = Boolean(item.subItems?.some((subItem) => subItem.isSelected));

        return (
            <NestedSubItems
                item={item}
                childSelected={childSelected}
            />
        );
    };

    return (
        <div ref={ref} className='sidebar-expandable-section'>
            <Button
                variant='ghost'
                intent='neutral'
                className={`sidebar-nav-item sidebar-section-header ${isActive ? 'is-selected' : ''} relative gap-3 w-full text-md font-normal text-secondary cursor-pointer`}
                onClick={handleToggle}
                disabled={disabled}
                aria-expanded={expanded}
                aria-controls={subItemsId}
            >
                <div className='sidebar-nav-icon text-xl'>
                    <Icon size='1em' />
                </div>
                <span className='sidebar-nav-label truncate'>{label}</span>
                <ChevronDown
                    className={`sidebar-section-chevron ${expanded ? 'is-expanded' : ''} text-muted`}
                    size={14}
                    aria-hidden='true'
                />
            </Button>

            {expanded && !disabled && (
                <ul id={subItemsId} className='sidebar-sub-items' role='list'>
                    {subItems.map((item, index) => (
                        <li key={item.label || index} className='sidebar-sub-item-wrapper'>
                            {renderSubItem(item)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
});

SidebarExpandableSection.displayName = 'SidebarExpandableSection';

export default SidebarExpandableSection;

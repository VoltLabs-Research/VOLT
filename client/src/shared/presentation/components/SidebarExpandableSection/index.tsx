import { useState } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import type { IconType } from 'react-icons';
import Container from '@/shared/presentation/components/Container';
import '@/shared/presentation/components/SidebarSubItems/SidebarSubItems.css';
import './SidebarExpandableSection.css';

export interface SubItem {
    label: string;
    isSelected?: boolean;
    onClick?: () => void;
};

interface SidebarExpandableSectionProps {
    label: string;
    icon: IconType;
    isActive?: boolean;
    subItems: SubItem[];
    defaultExpanded?: boolean;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
};

const SidebarExpandableSection = ({
    label,
    icon: Icon,
    isActive = false,
    subItems,
    defaultExpanded = false,
    expanded: controlledExpanded,
    onExpandedChange
}: SidebarExpandableSectionProps) => {
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
    
    const isControlled = controlledExpanded !== undefined;
    const expanded = isControlled ? controlledExpanded : internalExpanded;

    const handleToggle = () => {
        const newExpanded = !expanded;
        if (isControlled) {
            onExpandedChange?.(newExpanded);
        } else {
            setInternalExpanded(newExpanded);
        }
    };

    return (
        <>
            <button
                className={`sidebar-nav-item sidebar-section-header ${isActive ? 'is-selected' : ''} p-relative gap-075 w-max font-size-2 font-weight-4 color-secondary cursor-pointer`}
                onClick={handleToggle}
            >
                <Container className='sidebar-nav-icon font-size-4'>
                    <Icon />
                </Container>
                <span className='sidebar-nav-label'>{label}</span>
                <IoChevronDown
                    className={`sidebar-section-chevron ${expanded ? 'is-expanded' : ''} color-muted`}
                    size={14}
                />
            </button>

            {expanded && (
                <Container className='sidebar-sub-items'>
                    {subItems.map((item, index) => (
                        <button
                            key={index}
                            className={`sidebar-sub-item ${item.isSelected ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                            onClick={item.onClick}
                        >
                            {item.label}
                        </button>
                    ))}
                </Container>
            )}
        </>
    );
};

export default SidebarExpandableSection;

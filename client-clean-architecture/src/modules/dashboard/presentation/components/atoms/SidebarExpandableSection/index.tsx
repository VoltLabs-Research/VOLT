import { useState } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import type { IconType } from 'react-icons';
import Container from '@/shared/presentation/components/Container';
import SidebarSubItems, { type SubItem } from '../SidebarSubItems';
import './SidebarExpandableSection.css';

interface SidebarExpandableSectionProps {
    label: string;
    icon: IconType;
    isActive?: boolean;
    subItems: SubItem[];
    defaultExpanded?: boolean;
};

const SidebarExpandableSection = ({
    label,
    icon: Icon,
    isActive = false,
    subItems,
    defaultExpanded = false
}: SidebarExpandableSectionProps) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <>
            <button
                className={`sidebar-nav-item sidebar-section-header ${isActive ? 'is-selected' : ''} p-relative gap-075 w-max font-size-2 font-weight-4 color-secondary cursor-pointer`}
                onClick={() => setExpanded(!expanded)}
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

            {expanded && <SidebarSubItems items={subItems} />}
        </>
    );
};

export default SidebarExpandableSection;

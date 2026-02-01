import Container from '@/shared/presentation/components/Container';
import './SidebarSubItems.css';

export interface SubItem {
    label: string;
    isSelected?: boolean;
    onClick?: () => void;
};

interface SidebarSubItemsProps {
    items: SubItem[];
};

const SidebarSubItems = ({ items }: SidebarSubItemsProps) => {
    return (
        <Container className='sidebar-sub-items'>
            {items.map((item, index) => (
                <button
                    key={index}
                    className={`sidebar-sub-item ${item.isSelected ? 'is-selected' : ''} w-max color-secondary cursor-pointer`}
                    onClick={item.onClick}
                >
                    {item.label}
                </button>
            ))}
        </Container>
    );
};

export default SidebarSubItems;

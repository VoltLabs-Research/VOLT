import Container from '@/shared/presentation/components/Container';
import './PopoverMenu.css';
import React from 'react';

interface PopoverMenuProps {
    children: React.ReactNode;
};

const PopoverMenu: React.FC<PopoverMenuProps> = ({ children }) => {
    return (
        <Container className='popover-menu d-flex column gap-025'>
            {children}
        </Container>
    );
};

export default PopoverMenu;

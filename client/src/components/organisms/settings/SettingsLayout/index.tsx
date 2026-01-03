import React from 'react';
import { Outlet } from 'react-router-dom';
import Container from '@/components/primitives/Container';
import './SettingsLayout.css';

const SettingsLayout: React.FC = () => {
    return (
        <Container className='settings-layout-container flex-1 d-flex column w-max overflow-hidden'>
            <main className='settings-main y-auto flex-1'>
                <div className='settings-content-wrapper'>
                    <Outlet />
                </div>
            </main>
        </Container>
    );
};

export default SettingsLayout;

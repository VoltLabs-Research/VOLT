import React from 'react';
import { Outlet } from 'react-router-dom';
import Container from '@/components/primitives/Container';
import './SettingsLayout.css';

const SettingsLayout: React.FC = () => {
    return (
        <Container className='settings-layout-container flex-1 d-flex column w-max overflow-hidden h-max'>
            <main className='settings-main y-auto flex-1 p-2'>
                <div className='settings-content-wrapper'>
                    <Outlet />
                </div>
            </main>
        </Container>
    );
};

export default SettingsLayout;

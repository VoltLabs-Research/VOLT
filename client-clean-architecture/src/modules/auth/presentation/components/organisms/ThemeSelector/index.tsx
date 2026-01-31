import React from 'react';
import Container from '@/shared/presentation/components/Container';
import ThemeCard from '@/modules/auth/presentation/components/molecules/ThemeCard';
import { useTheme } from '@/shared/presentation/hooks/use-theme';
import { Sun, Moon } from 'lucide-react';
import './ThemeSelector.css';

const ThemeSelector: React.FC = () => {
    const { theme, setTheme } = useTheme();

    return (
        <Container className="theme-selector-grid">
            <ThemeCard
                theme="light"
                label="Light"
                icon={<Sun size={32} />}
                previewClassName="light-preview"
                isSelected={theme === 'light'}
                onClick={() => setTheme('light')}
            />
            <ThemeCard
                theme="dark"
                label="Dark"
                icon={<Moon size={32} />}
                previewClassName="dark-preview"
                isSelected={theme === 'dark'}
                onClick={() => setTheme('dark')}
            />
        </Container>
    );
};

export default ThemeSelector;

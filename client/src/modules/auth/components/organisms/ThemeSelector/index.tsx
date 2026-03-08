import './ThemeSelector.css';
import { useTheme } from '@/shared/presentation/hooks/use-theme';
import ThemeCard from '@/modules/auth/components/molecules/ThemeCard';
import Container from '@/shared/presentation/components/Container';
import { Sun, Moon } from 'lucide-react';

const ThemeSelector = () => {
    const { theme, setTheme } = useTheme();

    return (
        <Container className="theme-selector-grid gap-1">
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

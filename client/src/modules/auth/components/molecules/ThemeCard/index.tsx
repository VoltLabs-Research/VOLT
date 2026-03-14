import './ThemeCard.css';
import { cn } from '@/shared/utils';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import { Theme } from '@/shared/presentation/hooks/use-theme';
import themeTokensStylesheet from '@/shared/presentation/assets/stylesheets/theme.css?raw';
import { Check } from 'lucide-react';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

interface ThemePreviewStyles extends CSSProperties {
    '--theme-preview-bg-start': string;
    '--theme-preview-bg-end': string;
    '--theme-preview-fg': string;
    '--theme-preview-header-start': string;
    '--theme-preview-header-end': string;
    '--theme-preview-header-border': string;
    '--theme-preview-panel-start': string;
    '--theme-preview-panel-end': string;
};

interface ThemePreviewConfig {
    bgStart: string;
    bgEnd: string;
    fg: string;
    headerStart: string;
    headerEnd: string;
    headerBorder: string;
    panelStart: string;
    panelEnd: string;
};

interface ThemeTokenMap {
    [tokenName: string]: string;
};

const extractThemeTokens = (theme: Theme): ThemeTokenMap => {
    const blockPattern = new RegExp(`:root\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\}`, 'm');
    const blockMatch = themeTokensStylesheet.match(blockPattern);

    if (!blockMatch) {
        throw new Error(`Missing token block for theme: ${theme}`);
    }

    const declarations = blockMatch[1].matchAll(/(--[\w-]+):\s*([^;]+);/g);
    const tokens: ThemeTokenMap = {};

    for (const declaration of declarations) {
        const [, tokenName, tokenValue] = declaration;
        tokens[tokenName] = tokenValue.trim();
    }

    return tokens;
};

const createThemePreviewConfig = (theme: Theme): ThemePreviewConfig => {
    const tokens = extractThemeTokens(theme);

    return {
        bgStart: tokens['--color-bg'],
        bgEnd: tokens['--color-surface-1'],
        fg: tokens['--color-text-primary'],
        headerStart: tokens['--color-content-bg'],
        headerEnd: tokens['--color-surface-2'],
        headerBorder: tokens['--color-border-soft'],
        panelStart: tokens['--status-info-bg'],
        panelEnd: `color-mix(in srgb, ${tokens['--accent-indigo']} 20%, transparent)`
    };
};

const THEME_PREVIEW_CONFIG: Record<Theme, ThemePreviewConfig> = {
    [Theme.Light]: createThemePreviewConfig(Theme.Light),
    [Theme.Dark]: createThemePreviewConfig(Theme.Dark)
};

interface ThemeCardProps {
    theme: Theme;
    label: string;
    icon: ReactNode;
    previewClassName: string;
    isSelected: boolean;
    onClick: () => void;
    onKeyDown: ButtonHTMLAttributes<HTMLButtonElement>['onKeyDown'];
    tabIndex: number;
};

const ThemeCard = forwardRef<HTMLButtonElement, ThemeCardProps>(({ 
    theme,
    label,
    icon,
    previewClassName,
    isSelected,
    onClick,
    onKeyDown,
    tabIndex
}, ref) => {
    const cardClasses = cn(
        'theme-card',
        'transition-normal',
        'radius-md',
        'cursor-pointer',
        'overflow-hidden',
        isSelected && 'selected'
    );

    const preview = THEME_PREVIEW_CONFIG[theme];
    const previewStyles: ThemePreviewStyles = {
        '--theme-preview-bg-start': preview.bgStart,
        '--theme-preview-bg-end': preview.bgEnd,
        '--theme-preview-fg': preview.fg,
        '--theme-preview-header-start': preview.headerStart,
        '--theme-preview-header-end': preview.headerEnd,
        '--theme-preview-header-border': preview.headerBorder,
        '--theme-preview-panel-start': preview.panelStart,
        '--theme-preview-panel-end': preview.panelEnd
    };

    return (
        <button
            ref={ref}
            type='button'
            className={cardClasses}
            onClick={onClick}
            onKeyDown={onKeyDown}
            role='radio'
            aria-checked={isSelected}
            aria-label={`${label} theme`}
            data-theme-preview={theme}
            tabIndex={tabIndex}
        >
            <Container className={`theme-preview ${previewClassName} d-flex items-center content-center p-relative`} style={previewStyles}>
                {icon}
            </Container>
            <Container className='d-flex column gap-025 p-1'>
                <Container className='d-flex items-center content-between'>
                    <Title className='font-size-2 font-weight-6'>
                        {label}
                    </Title>
                    {isSelected && (
                        <Check size={18} className='theme-card-check' aria-hidden='true' />
                    )}
                </Container>
            </Container>
        </button>
    );
});

ThemeCard.displayName = 'ThemeCard';

export default ThemeCard;

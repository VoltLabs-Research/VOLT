import './ThemeCard.css';
import { Theme } from '@/shared/presentation/hooks/use-theme';
import themeTokensStylesheet from '@/shared/presentation/assets/stylesheets/theme.css?raw';
import Row from '@/shared/presentation/primitives/Row';
import SelectableCard from '@/shared/presentation/primitives/SelectableCard';
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
}

interface SystemPreviewStyles extends CSSProperties {
    '--theme-preview-light-bg': string;
    '--theme-preview-dark-bg': string;
    '--theme-preview-dark-fg': string;
}

interface ThemePreviewConfig {
    bgStart: string;
    bgEnd: string;
    fg: string;
    headerStart: string;
    headerEnd: string;
    headerBorder: string;
    panelStart: string;
    panelEnd: string;
}

interface ThemeTokenMap {
    [tokenName: string]: string;
}

type VisualTheme = Theme.Light | Theme.Dark;

const extractThemeTokens = (theme: VisualTheme): ThemeTokenMap => {
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

const createThemePreviewConfig = (theme: VisualTheme): ThemePreviewConfig => {
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

const THEME_PREVIEW_CONFIG: Record<VisualTheme, ThemePreviewConfig> = {
    [Theme.Light]: createThemePreviewConfig(Theme.Light),
    [Theme.Dark]: createThemePreviewConfig(Theme.Dark)
};

const getPreviewStyles = (theme: Theme): ThemePreviewStyles | SystemPreviewStyles => {
    if (theme === Theme.System) {
        const lightConfig = THEME_PREVIEW_CONFIG[Theme.Light];
        const darkConfig = THEME_PREVIEW_CONFIG[Theme.Dark];

        return {
            '--theme-preview-light-bg': lightConfig.bgStart,
            '--theme-preview-dark-bg': darkConfig.bgStart,
            '--theme-preview-dark-fg': darkConfig.fg
        };
    }

    const preview = THEME_PREVIEW_CONFIG[theme];

    return {
        '--theme-preview-bg-start': preview.bgStart,
        '--theme-preview-bg-end': preview.bgEnd,
        '--theme-preview-fg': preview.fg,
        '--theme-preview-header-start': preview.headerStart,
        '--theme-preview-header-end': preview.headerEnd,
        '--theme-preview-header-border': preview.headerBorder,
        '--theme-preview-panel-start': preview.panelStart,
        '--theme-preview-panel-end': preview.panelEnd
    };
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
}

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
    const previewStyles = getPreviewStyles(theme);

    return (
        <SelectableCard
            ref={ref}
            className='theme-card'
            selected={isSelected}
            selectionRole='radio'
            title={label}
            badge={isSelected ? <Check size={14} aria-hidden='true' /> : undefined}
            onSelect={onClick}
            onKeyDown={onKeyDown}
            aria-label={`${label} theme`}
            data-theme-preview={theme}
            tabIndex={tabIndex}
        >
            <Row justify='center' position='relative' className={`theme-preview ${previewClassName}`} style={previewStyles}>
                {icon}
            </Row>
        </SelectableCard>
    );
});

ThemeCard.displayName = 'ThemeCard';

export default ThemeCard;

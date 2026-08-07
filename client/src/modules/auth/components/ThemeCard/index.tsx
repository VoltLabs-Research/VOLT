import './ThemeCard.css';
import { Theme } from '@/shared/ui/hooks/use-theme';
import type { VisualTheme } from '@/shared/ui/hooks/use-theme';
import themeTokensStylesheet from '@voltstack/bravais/styles.css?raw';
import { Row, SelectableCard } from '@voltstack/bravais';
import { Check } from 'lucide-react';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type PreviewStyles = CSSProperties & Record<`--${string}`, string>;

/*
 * A preview shows both themes at once, so the values cannot be read off the
 * document: only the active theme is computed. They are parsed out of the token
 * sheet instead. bravais's published sheet normalises the attribute selector's
 * quotes away, so the pattern accepts the token block either way.
 */
const extractThemeTokens = (theme: VisualTheme): Record<string, string> => {
    const blockPattern = new RegExp(`:root\\[data-theme=['"]?${theme}['"]?\\]\\s*\\{([\\s\\S]*?)\\}`, 'm');
    const blockMatch = themeTokensStylesheet.match(blockPattern);

    if (!blockMatch) {
        throw new Error(`Missing token block for theme: ${theme}`);
    }

    const declarations = blockMatch[1].matchAll(/(--[\w-]+):\s*([^;]+);/g);
    const tokens: Record<string, string> = {};

    for (const declaration of declarations) {
        const [, tokenName, tokenValue] = declaration;
        tokens[tokenName] = tokenValue.trim();
    }

    return tokens;
};

const THEME_TOKENS: Record<VisualTheme, Record<string, string>> = {
    [Theme.Light]: extractThemeTokens(Theme.Light),
    [Theme.Dark]: extractThemeTokens(Theme.Dark)
};

const getPreviewStyles = (theme: Theme): PreviewStyles => {
    if (theme === Theme.System) {
        return {
            '--theme-preview-light-bg': THEME_TOKENS[Theme.Light]['--color-bg'],
            '--theme-preview-dark-bg': THEME_TOKENS[Theme.Dark]['--color-bg'],
            '--theme-preview-dark-fg': THEME_TOKENS[Theme.Dark]['--color-text-primary']
        };
    }

    const tokens = THEME_TOKENS[theme];

    return {
        '--theme-preview-bg-start': tokens['--color-bg'],
        '--theme-preview-bg-end': tokens['--color-surface-1'],
        '--theme-preview-fg': tokens['--color-text-primary'],
        '--theme-preview-header-start': tokens['--color-content-bg'],
        '--theme-preview-header-end': tokens['--color-surface-2'],
        '--theme-preview-header-border': tokens['--color-border-soft'],
        '--theme-preview-panel-start': tokens['--status-info-bg'],
        '--theme-preview-panel-end': `color-mix(in srgb, ${tokens['--accent-indigo']} 20%, transparent)`
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
            <Row justify='center' position='relative' className={`theme-preview ${previewClassName}`} style={getPreviewStyles(theme)}>
                {icon}
            </Row>
        </SelectableCard>
    );
});

ThemeCard.displayName = 'ThemeCard';

export default ThemeCard;

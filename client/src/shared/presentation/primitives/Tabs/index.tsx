import { cn } from '@/shared/utils/cn';
import './Tabs.css';
import {
    createContext,
    forwardRef,
    useCallback,
    useContext,
    useId,
    useMemo,
    useRef,
    useState
} from 'react';
import type {
    ButtonHTMLAttributes,
    HTMLAttributes,
    KeyboardEvent,
    MutableRefObject,
    ReactNode
} from 'react';
import type { ControlSize } from '../types';

const MISSING_TABS_LABEL_ERROR = 'Tabs.List requires an accessible name via aria-label or aria-labelledby so assistive tech can announce the tab group.';

/** Tabs supports the standard control sizes; underline content tabs read best at sm/md/lg. */
export type TabsSize = Extract<ControlSize, 'sm' | 'md' | 'lg'>;

interface TabsContextValue {
    /** Stable id used to namespace every tab/panel id pair. */
    baseId: string;
    /** The currently selected tab value. */
    value: string | undefined;
    /** Selects a tab by value (no-op when disabled). */
    selectValue: (next: string) => void;
    /** Visual size shared with Tab/Panel descendants. */
    size: TabsSize;
    /** Registry of focusable (non-disabled) tab values in DOM order, for roving focus. */
    registerTab: (value: string, disabled: boolean) => void;
    unregisterTab: (value: string) => void;
    /** Imperatively move focus to the tab with the given value. */
    focusTab: (value: string) => void;
    /** Ordered, currently-focusable tab values resolved on demand. */
    orderedValuesRef: MutableRefObject<string[]>;
    tabNodesRef: MutableRefObject<Map<string, HTMLButtonElement>>;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabsContext = (component: string): TabsContextValue => {
    const ctx = useContext(TabsContext);
    if (!ctx) {
        throw new Error(`${component} must be rendered inside <Tabs>.`);
    }
    return ctx;
};

const tabId = (baseId: string, value: string) => `${baseId}-tab-${value}`;
const panelId = (baseId: string, value: string) => `${baseId}-panel-${value}`;

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
    /** Controlled selected value. Pair with `onChange`. */
    value?: string;
    /** Initial selected value when uncontrolled. */
    defaultValue?: string;
    /** Fires with the next value whenever selection changes. */
    onChange?: (value: string) => void;
    /** Visual scale shared by every tab + panel. */
    size?: TabsSize;
    children?: ReactNode;
    className?: string;
};

interface TabsComponent
    extends React.ForwardRefExoticComponent<TabsProps & React.RefAttributes<HTMLDivElement>> {
    List: typeof TabsList;
    Tab: typeof Tab;
    Panel: typeof TabsPanel;
};

const TabsRoot = forwardRef<HTMLDivElement, TabsProps>(({
    value: controlledValue,
    defaultValue,
    onChange,
    size = 'md',
    className,
    children,
    ...rest
}, ref) => {
    const baseId = useId();
    const isControlled = controlledValue !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = useState<string | undefined>(defaultValue);
    const value = isControlled ? controlledValue : uncontrolledValue;

    // DOM-ordered registry: a Map preserves insertion order, which mirrors render order.
    const registryRef = useRef<Map<string, boolean>>(new Map());
    const orderedValuesRef = useRef<string[]>([]);
    const tabNodesRef = useRef<Map<string, HTMLButtonElement>>(new Map());

    const recomputeOrder = useCallback(() => {
        orderedValuesRef.current = Array.from(registryRef.current.entries())
            .filter(([, disabled]) => !disabled)
            .map(([tabValue]) => tabValue);
    }, []);

    const registerTab = useCallback((tabValue: string, disabled: boolean) => {
        registryRef.current.set(tabValue, disabled);
        recomputeOrder();
    }, [recomputeOrder]);

    const unregisterTab = useCallback((tabValue: string) => {
        registryRef.current.delete(tabValue);
        tabNodesRef.current.delete(tabValue);
        recomputeOrder();
    }, [recomputeOrder]);

    const selectValue = useCallback((next: string) => {
        if (!isControlled) {
            setUncontrolledValue(next);
        }
        onChange?.(next);
    }, [isControlled, onChange]);

    const focusTab = useCallback((tabValue: string) => {
        tabNodesRef.current.get(tabValue)?.focus();
    }, []);

    const contextValue = useMemo<TabsContextValue>(() => ({
        baseId,
        value,
        selectValue,
        size,
        registerTab,
        unregisterTab,
        focusTab,
        orderedValuesRef,
        tabNodesRef
    }), [baseId, value, selectValue, size, registerTab, unregisterTab, focusTab]);

    return (
        <TabsContext.Provider value={contextValue}>
            <div
                ref={ref}
                className={cn('volt-tabs', `volt-tabs--${size}`, className)}
                {...rest}
            >
                {children}
            </div>
        </TabsContext.Provider>
    );
});

TabsRoot.displayName = 'Tabs';

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
    children?: ReactNode;
    className?: string;
};

const TabsList = forwardRef<HTMLDivElement, TabsListProps>(({
    className,
    children,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...rest
}, ref) => {
    const { size } = useTabsContext('Tabs.List');
    const hasWarnedForMissingNameRef = useRef(false);

    const resolvedAriaLabel = ariaLabel?.trim() || undefined;
    const resolvedAriaLabelledBy = ariaLabelledBy?.trim() || undefined;

    if (!resolvedAriaLabel && !resolvedAriaLabelledBy && !hasWarnedForMissingNameRef.current) {
        console.warn(MISSING_TABS_LABEL_ERROR);
        hasWarnedForMissingNameRef.current = true;
    }

    return (
        <div
            ref={ref}
            role='tablist'
            aria-label={resolvedAriaLabel}
            aria-labelledby={resolvedAriaLabelledBy}
            aria-orientation='horizontal'
            className={cn('volt-tabs__list', 'd-flex', 'items-end', 'border-bottom-soft', `volt-tabs__list--${size}`, className)}
            {...rest}
        >
            {children}
        </div>
    );
});

TabsList.displayName = 'Tabs.List';

type NativeTabButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onClick'>;

export interface TabProps extends NativeTabButtonProps {
    /** Identifies this tab; must match the Panel `value` it controls. */
    value: string;
    children?: ReactNode;
    /** Optional leading icon, rendered decoratively (aria-hidden). */
    leftIcon?: ReactNode;
    disabled?: boolean;
    className?: string;
};

const Tab = forwardRef<HTMLButtonElement, TabProps>(({
    value,
    children,
    leftIcon,
    disabled = false,
    className,
    id,
    onKeyDown,
    ...rest
}, ref) => {
    const {
        baseId,
        value: selectedValue,
        selectValue,
        size,
        registerTab,
        unregisterTab,
        focusTab,
        orderedValuesRef,
        tabNodesRef
    } = useTabsContext('Tabs.Tab');

    const isSelected = selectedValue === value;
    const resolvedTabId = id ?? tabId(baseId, value);
    const resolvedPanelId = panelId(baseId, value);

    // Register in DOM order for roving focus; keep the registry in sync with disabled state.
    const setNodeRef = useCallback((node: HTMLButtonElement | null) => {
        if (node) {
            tabNodesRef.current.set(value, node);
            registerTab(value, disabled);
        } else {
            unregisterTab(value);
        }

        if (typeof ref === 'function') {
            ref(node);
        } else if (ref) {
            (ref as MutableRefObject<HTMLButtonElement | null>).current = node;
        }
    }, [value, disabled, registerTab, unregisterTab, tabNodesRef, ref]);

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) {
            return;
        }

        const order = orderedValuesRef.current;
        const currentIndex = order.indexOf(value);
        if (currentIndex === -1) {
            return;
        }

        let nextValue: string | undefined;
        switch (event.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                nextValue = order[(currentIndex + 1) % order.length];
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                nextValue = order[(currentIndex - 1 + order.length) % order.length];
                break;
            case 'Home':
                nextValue = order[0];
                break;
            case 'End':
                nextValue = order[order.length - 1];
                break;
            default:
                return;
        }

        if (nextValue !== undefined) {
            event.preventDefault();
            selectValue(nextValue);
            focusTab(nextValue);
        }
    };

    return (
        <button
            ref={setNodeRef}
            type='button'
            role='tab'
            id={resolvedTabId}
            aria-selected={isSelected}
            aria-controls={resolvedPanelId}
            tabIndex={isSelected ? 0 : -1}
            disabled={disabled}
            className={cn(
                'volt-tabs__tab',
                'd-flex',
                'items-center',
                'transition-fast',
                `volt-tabs__tab--${size}`,
                isSelected && 'is-selected',
                disabled && 'is-disabled',
                className
            )}
            onClick={() => {
                if (disabled) return;
                selectValue(value);
            }}
            onKeyDown={handleKeyDown}
            {...rest}
        >
            {leftIcon && (
                <span className='volt-tabs__tab-icon d-flex flex-center' aria-hidden='true'>
                    {leftIcon}
                </span>
            )}
            <span className='volt-tabs__tab-label'>{children}</span>
            <span className='volt-tabs__indicator' aria-hidden='true' />
        </button>
    );
});

Tab.displayName = 'Tabs.Tab';

export interface TabsPanelProps extends HTMLAttributes<HTMLDivElement> {
    /** Identifies the tab whose selection reveals this panel. */
    value: string;
    children?: ReactNode;
    /**
     * Keep the panel mounted (just hidden) when inactive. Defaults to `false`,
     * which unmounts inactive panels so heavy 3D/chart content does not stay live.
     */
    keepMounted?: boolean;
    className?: string;
};

const TabsPanel = forwardRef<HTMLDivElement, TabsPanelProps>(({
    value,
    children,
    keepMounted = false,
    className,
    id,
    ...rest
}, ref) => {
    const { baseId, value: selectedValue } = useTabsContext('Tabs.Panel');
    const isSelected = selectedValue === value;

    if (!isSelected && !keepMounted) {
        return null;
    }

    return (
        <div
            ref={ref}
            role='tabpanel'
            id={id ?? panelId(baseId, value)}
            aria-labelledby={tabId(baseId, value)}
            hidden={!isSelected}
            tabIndex={0}
            className={cn('volt-tabs__panel', className)}
            {...rest}
        >
            {children}
        </div>
    );
});

TabsPanel.displayName = 'Tabs.Panel';

const Tabs = TabsRoot as TabsComponent;
Tabs.List = TabsList;
Tabs.Tab = Tab;
Tabs.Panel = TabsPanel;

export { TabsList, Tab, TabsPanel };

export default Tabs;

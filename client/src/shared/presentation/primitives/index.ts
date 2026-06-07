/**
 * Public barrel for the VOLT design-system primitives — the stable entrypoint a
 * consumer (the VOLT client today; the extracted @voltstack/volt-ui package and
 * cloud-services/Console + Registry tomorrow) imports from.
 *
 * Import primitives by name from here instead of deep-importing folder paths, e.g.:
 *   import { Stack, Row, Text, Button, Tag, TextInput } from '@/shared/presentation/primitives';
 *
 * Foundation (design tokens as TS types + the style-prop → utility-class mappers)
 * is re-exported too so consumers share one vocabulary.
 */

/* ── Foundation ─────────────────────────────────────────────────────────── */
export * from './types';
export * from './buildBoxClasses';
export * from './typography';

/* ── Layout ─────────────────────────────────────────────────────────────── */
export { default as Box } from './Box';
export * from './Box';
export { default as Stack } from './Stack';
export * from './Stack';
export { default as Row } from './Row';
export * from './Row';
export { default as Grid } from './Grid';
export * from './Grid';
export { default as Surface } from './Surface';
export * from './Surface';
export { default as Divider } from './Divider';
export * from './Divider';

/* ── Typography ─────────────────────────────────────────────────────────── */
export { default as Text } from './Text';
export * from './Text';
export { default as Heading } from './Heading';
export * from './Heading';
export { default as SectionLabel } from './SectionLabel';
export * from './SectionLabel';

/* ── Actions / controls ─────────────────────────────────────────────────── */
export { default as Button } from './Button';
export * from './Button';
export { default as IconButton } from './IconButton';
export * from './IconButton';
export { default as CloseButton } from './CloseButton';
export * from './CloseButton';
export { default as Select } from './Select';
export * from './Select';
export { default as SegmentedTabs } from './SegmentedTabs';
export * from './SegmentedTabs';
export { default as Slider } from './Slider';
export * from './Slider';
export { default as LiquidToggle } from './LiquidToggle';
export * from './LiquidToggle';
export { default as Stepper } from './Stepper';
export * from './Stepper';

/* ── Form inputs ────────────────────────────────────────────────────────── */
export { default as TextInput } from './TextInput';
export * from './TextInput';
export { default as Textarea } from './Textarea';
export * from './Textarea';
export { default as NumberInput } from './NumberInput';
export * from './NumberInput';
export { default as SearchInput } from './SearchInput';
export * from './SearchInput';
export { default as FormField } from './FormField';
export * from './FormField';
export { default as Checkbox } from './Checkbox';
export * from './Checkbox';
export { default as Radio } from './Radio';
export * from './Radio';

/* ── Navigation / disclosure ────────────────────────────────────────────── */
export { default as Tabs } from './Tabs';
export * from './Tabs';
export { default as Breadcrumbs } from './Breadcrumbs';
export * from './Breadcrumbs';
export { default as CollapsibleSection } from './CollapsibleSection';
export * from './CollapsibleSection';

/* ── Overlays / floating ────────────────────────────────────────────────── */
export { default as Modal } from './Modal';
export * from './Modal';
export { default as Popover } from './Popover';
export * from './Popover';
export { default as PopoverMenu } from './PopoverMenu';
export * from './PopoverMenu';
export { default as PopoverMenuItem } from './PopoverMenuItem';
export * from './PopoverMenuItem';
export { default as Menu } from './Menu';
export * from './Menu';
export { default as ContextMenuPopover } from './ContextMenuPopover';
export * from './ContextMenuPopover';
export { default as AsyncMenuItemWrapper } from './AsyncMenuItemWrapper';
export * from './AsyncMenuItemWrapper';
export { default as Tooltip } from './Tooltip';
export * from './Tooltip';
export { default as CursorTooltip } from './CursorTooltip';
export * from './CursorTooltip';
export { default as FloatingToolbar } from './FloatingToolbar';
export * from './FloatingToolbar';

/* ── Data display ───────────────────────────────────────────────────────── */
export { default as Tag } from './Tag';
export * from './Tag';
export { default as StatusBadge } from './StatusBadge';
export * from './StatusBadge';
export { default as StatusDot } from './StatusDot';
export * from './StatusDot';
export { default as InlineStatus } from './InlineStatus';
export * from './InlineStatus';
export { default as SaveStatusIndicator } from './SaveStatusIndicator';
export * from './SaveStatusIndicator';
export { default as Avatar } from './Avatar';
export * from './Avatar';
export { default as AvatarStack } from './AvatarStack';
export * from './AvatarStack';
export { default as IconFrame } from './IconFrame';
export * from './IconFrame';
export { default as Card } from './Card';
export * from './Card';
export { default as StatCard } from './StatCard';
export * from './StatCard';
export { default as SelectableCard } from './SelectableCard';
export * from './SelectableCard';
export { default as DashedActionBox } from './DashedActionBox';
export * from './DashedActionBox';
export { default as KeyValueList } from './KeyValueList';
export * from './KeyValueList';
export { default as ListRow } from './ListRow';
export * from './ListRow';
export { default as Table } from './Table';
export * from './Table';
export { default as Timeline } from './Timeline';
export * from './Timeline';
export { default as Sparkline } from './Sparkline';
export * from './Sparkline';
export { default as Callout } from './Callout';
export * from './Callout';
export { default as EmptyState } from './EmptyState';
export * from './EmptyState';
export { default as Toast } from './Toast';
export * from './Toast';

/* ── Feedback / progress ────────────────────────────────────────────────── */
export { default as Loader } from './Loader';
export * from './Loader';
export { default as Skeleton } from './Skeleton';
export * from './Skeleton';
export { default as ThinkingDots } from './ThinkingDots';
export * from './ThinkingDots';
export { default as ProgressBar } from './ProgressBar';
export * from './ProgressBar';
export { default as Meter } from './Meter';
export * from './Meter';
export { default as AsyncBoundary } from './AsyncBoundary';
export * from './AsyncBoundary';

/* ── Utilities ──────────────────────────────────────────────────────────── */
export { default as VisuallyHidden } from './VisuallyHidden';
export * from './VisuallyHidden';

/**
 * Canonical primitive set for the Volt frontend.
 *
 * All UI code should import atoms from this entry point rather than
 * reaching directly into `components/`:
 *
 *   import { Box, Stack, Text, Button } from '@/shared/presentation/primitives';
 *
 * See `PRIMITIVES_REFACTOR_PLAN.md` for the design rationale.
 */

// --- Tier 1: layout & typography ------------------------------------------
export { default as Box } from './Box';
export type { BoxProps } from './Box';

export { default as Stack } from './Stack';
export type { StackProps } from './Stack';

export { default as Row } from './Row';
export type { RowProps } from './Row';

export { default as Text } from './Text';
export type { TextProps } from './Text';

export { default as Heading } from './Heading';
export type { HeadingProps, HeadingLevel } from './Heading';

export { default as Divider } from './Divider';
export type { DividerProps } from './Divider';

export { default as Surface } from './Surface';
export type { SurfaceProps } from './Surface';

export type {
    BoxStyleProps
} from './buildBoxClasses';

export type {
    Display,
    FlexDirection,
    AlignItems,
    JustifyContent,
    GapToken,
    PaddingToken,
    PaddingXToken,
    MarginTopToken,
    MarginBottomToken,
    MarginXToken,
    RadiusToken,
    BorderToken,
    PositionToken,
    OverflowToken,
    WidthToken,
    HeightToken,
    FlexToken,
    TransitionToken,
    TextSize,
    TextWeight,
    TextTone,
    TextAlign,
    SurfaceVariant,
    AlertTone
} from './types';

// --- Tier 2: form atoms ---------------------------------------------------
export { default as Input } from './Input';
export type { InputProps } from './Input';

export { default as Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';

export { default as FormLabel } from './FormLabel';
export type { FormLabelProps } from './FormLabel';

export { default as HelperText } from './HelperText';
export type { HelperTextProps } from './HelperText';

export { default as ErrorText } from './ErrorText';
export type { ErrorTextProps } from './ErrorText';

// --- Tier 3: feedback & content ------------------------------------------
export { default as Alert } from './Alert';
export type { AlertProps } from './Alert';

export { default as ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';

export { default as Kbd } from './Kbd';
export type { KbdProps } from './Kbd';

export { default as Link } from './Link';
export type { LinkProps } from './Link';

export { default as Breadcrumb } from './Breadcrumb';
export type { BreadcrumbProps, BreadcrumbItemData } from './Breadcrumb';

export { default as Card } from './Card';
export type { CardProps, CardVariant } from './Card';

export { default as VisuallyHidden } from './VisuallyHidden';
export type { VisuallyHiddenProps } from './VisuallyHidden';

export { default as SectionLabel } from './SectionLabel';
export type { SectionLabelProps } from './SectionLabel';

export { default as Tag } from './Tag';
export type { TagProps, TagTone, TagSize, TagVariant, TagShape } from './Tag';

export { default as IconFrame } from './IconFrame';
export type { IconFrameProps, IconFrameSize, IconFrameTone, IconFrameShape } from './IconFrame';

export { default as StatCard } from './StatCard';
export type { StatCardProps, StatCardTone, StatCardState } from './StatCard';

export { default as SelectableCard } from './SelectableCard';
export type { SelectableCardProps } from './SelectableCard';

export { default as ActionTile } from './ActionTile';
export type { ActionTileProps } from './ActionTile';

export { default as ListRow } from './ListRow';
export type { ListRowProps } from './ListRow';

export { default as KeyValueList, KeyValueRow } from './KeyValueList';
export type { KeyValueListProps, KeyValueRowProps } from './KeyValueList';

export { default as FloatingToolbar } from './FloatingToolbar';
export type { FloatingToolbarProps, FloatingToolbarPlacement, FloatingToolbarAlign } from './FloatingToolbar';

export { default as SaveStatusIndicator } from './SaveStatusIndicator';
export type { SaveStatusIndicatorProps, SaveStatus } from './SaveStatusIndicator';

export { default as InlineStatus } from './InlineStatus';
export type { InlineStatusProps, InlineStatusTone } from './InlineStatus';

export { default as DashedActionBox } from './DashedActionBox';
export type { DashedActionBoxProps, DashedActionTone, DashedActionSize } from './DashedActionBox';

export { default as Timeline, TimelineItem } from './Timeline';
export type { TimelineProps, TimelineItemProps, TimelineTone } from './Timeline';

export { default as ThinkingDots } from './ThinkingDots';
export type { ThinkingDotsProps } from './ThinkingDots';

export { default as AsyncBoundary } from './AsyncBoundary';
export type { AsyncBoundaryProps, AsyncBoundaryState } from './AsyncBoundary';

// --- Re-exports: existing atoms (kept in place under components/) --------
export { default as Button } from './Button';
export type { ButtonProps } from './Button';

export { default as IconButton } from './IconButton';

export { default as Icon } from './Icon';

export { default as CloseButton } from './CloseButton';

export { default as Avatar } from './Avatar';

export { default as AvatarStack } from './AvatarStack';

export { default as Loader } from './Loader';

export { default as Skeleton } from './Skeleton';
export type { SkeletonProps, SkeletonVariant, SkeletonAnimation } from './Skeleton';

export { default as Slider } from './Slider';
export type { SliderProps } from './Slider';

// Canonical alias for LiquidToggle
export { default as Switch } from './LiquidToggle';
export { default as LiquidToggle } from './LiquidToggle';

// Canonical alias for StatusBadge
export { default as Badge } from './StatusBadge';
export { default as StatusBadge } from './StatusBadge';
export type { StatusBadgeProps } from './StatusBadge';

export { default as StatusDot } from './StatusDot';
export type { StatusDotTone } from './StatusDot';

export { default as Tooltip } from './Tooltip';
export type { TooltipPlacement } from './Tooltip';

export { default as Popover } from './Popover';

export { default as Modal, openModal, closeModal, resetModal } from './Modal';

export { default as SegmentedTabs } from './SegmentedTabs';
export type { SegmentedTabOption } from './SegmentedTabs';

export { default as Stepper } from './Stepper';
export type { Step, StepIndicator, StepTitles } from './Stepper';

export { default as Table, TableSortDirection } from './Table';
export type { Column } from './Table';

export { default as TableRow } from '@/shared/presentation/components/TableRow';

export { default as SearchInput } from './SearchInput';

export { default as Select } from './Select';
export type { SelectOption } from './Select';

export { default as EmptyState } from './EmptyState';

export { default as CollapsibleSection } from './CollapsibleSection';

export { default as PopoverMenu } from './PopoverMenu';
export { default as PopoverMenuItem } from './PopoverMenuItem';
export { default as AsyncMenuItemWrapper } from './AsyncMenuItemWrapper';

export { default as ContextMenuPopover } from './ContextMenuPopover';

export { default as CursorTooltip } from './CursorTooltip';

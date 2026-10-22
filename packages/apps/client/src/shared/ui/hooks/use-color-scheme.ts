import { getActiveAppTheme, subscribeToAppTheme } from '@/shared/ui/utils/app-theme';
import { useSyncExternalStore } from 'react';
import type { VisualTheme } from '@/shared/ui/hooks/use-theme';

// The theme the document is painted in, kept current when the reader switches it.
export const useColorScheme = (): VisualTheme => useSyncExternalStore(subscribeToAppTheme, getActiveAppTheme);

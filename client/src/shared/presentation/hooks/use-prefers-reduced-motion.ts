import useMedia from '@/shared/presentation/hooks/use-media';

const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

export const usePrefersReducedMotion = (): boolean => useMedia(REDUCED_MOTION_MEDIA_QUERY);

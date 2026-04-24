import useMedia from '@/shared/presentation/hooks/use-media';

const NARROW_MEDIA_QUERY = '(max-width: 1199px)';

const useViewportNarrow = (): boolean => useMedia(NARROW_MEDIA_QUERY);

export default useViewportNarrow;

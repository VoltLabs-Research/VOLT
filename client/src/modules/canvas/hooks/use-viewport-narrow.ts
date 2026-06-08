import { useMedia } from '@voltstack/bravais';

const NARROW_MEDIA_QUERY = '(max-width: 1199px)';

const useViewportNarrow = (): boolean => useMedia(NARROW_MEDIA_QUERY);

export default useViewportNarrow;

import { useMemo } from 'react';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import { selectFractalSceneConfig, selectFractalSceneConfigSignature } from '@/modules/fractal/presentation/stores/editor/selectors';

const useFractalSceneConfig = () => {
    const signature = useEditorStore(selectFractalSceneConfigSignature);
    return useMemo(() => selectFractalSceneConfig(useEditorStore.getState()), [signature]);
};

export default useFractalSceneConfig;

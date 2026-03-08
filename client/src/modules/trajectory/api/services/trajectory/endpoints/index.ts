import crud from './crud';
import assets from './assets';
import metrics from './metrics';
import samples from './samples';

export default {
    ...crud,
    ...assets,
    ...metrics,
    ...samples
};

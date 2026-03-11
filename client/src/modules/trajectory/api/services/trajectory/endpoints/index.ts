import crud from './crud';
import assets from './assets';
import folders from './folders';
import metrics from './metrics';
import samples from './samples';

export default {
    ...crud,
    ...assets,
    ...folders,
    ...metrics,
    ...samples
};

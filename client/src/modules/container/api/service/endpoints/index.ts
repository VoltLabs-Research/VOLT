import crud from './crud';
import files from './files';
import stats from './stats';

export default {
    ...crud,
    ...files,
    ...stats
};
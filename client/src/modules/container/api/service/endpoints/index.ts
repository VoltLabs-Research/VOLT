import crud from './crud';
import files from './files';
import processes from './processes';
import stats from './stats';

export default {
    ...crud,
    ...files,
    ...processes,
    ...stats
};

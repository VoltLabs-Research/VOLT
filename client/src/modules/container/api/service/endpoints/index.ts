import crud from './crud';
import files from './files';
import folders from './folders';
import processes from './processes';
import stats from './stats';

export default {
    ...crud,
    ...files,
    ...folders,
    ...processes,
    ...stats
};

import crud from './crud';
import files from './files';
import actions from './actions';

export default {
    ...crud,
    ...files,
    ...actions
};

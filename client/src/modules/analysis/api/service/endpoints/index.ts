import crud from './crud';
import actions from './actions';
import logs from './logs';

export default {
    ...crud,
    ...actions,
    ...logs
};

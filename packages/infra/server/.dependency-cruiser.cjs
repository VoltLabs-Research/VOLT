'use strict';

module.exports = require('@volt/tooling/depcruise-backend')({
    kernelModules: ['auth', 'session', 'socket', 'team'],
    circularDebt: 'circular imports still present in ai and auth.'
});

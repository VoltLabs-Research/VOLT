## Socket module migration note

This module is intentionally outside the standard query migration scope.

- It provides socket transport, room subscription, and event hooks rather than query helpers.
- The only query-related behavior here is targeted cache invalidation for team AI integration events.
- No legacy socket barrel imports were found during the migration audit.

/**
 * Whether the selected cluster's machine can run containers.
 *
 * Three states rather than a boolean, because "not reported yet" and "reported as
 * absent" call for opposite behaviour: a cluster still loading, or one whose
 * daemon has not sent a heartbeat, must not flash the "Docker needed" screen at a
 * user whose machine has Docker.
 */
export type ContainerRuntimeAvailability = 'available' | 'unavailable' | 'unknown';

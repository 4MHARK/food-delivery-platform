import EventEmitter from "events";

// Singleton event bus shared across all modules
const bus = new EventEmitter();
bus.setMaxListeners(200);

/**
 * Notify specific users that something changed.
 * Each listener filters by its own userId.
 */
export function notify(event, userIds, data) {
  if (!userIds || userIds.length === 0) return;
  bus.emit(event, userIds, data);
}

export { bus };

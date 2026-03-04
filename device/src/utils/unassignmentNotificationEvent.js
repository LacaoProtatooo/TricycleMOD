/**
 * unassignmentNotificationEvent.js
 *
 * Simple event emitter to communicate between NotificationHandler (which detects
 * incoming push notifications) and App.js (which renders the unassignment modal).
 *
 * Usage:
 *   emit: unassignmentNotifEmitter.emit('show', { title, body, data })
 *   listen: unassignmentNotifEmitter.on('show', callback)
 *   cleanup: unassignmentNotifEmitter.off('show', callback)
 */

class UnassignmentNotifEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach((cb) => cb(data));
  }
}

const unassignmentNotifEmitter = new UnassignmentNotifEmitter();
export default unassignmentNotifEmitter;

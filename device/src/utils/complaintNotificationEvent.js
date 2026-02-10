/**
 * complaintNotificationEvent.js
 *
 * Simple event emitter to communicate between NotificationHandler (which detects
 * incoming push notifications) and App.js (which renders the complaint modal).
 *
 * Usage:
 *   emit: complaintNotifEmitter.emit('show', { type, title, body, data })
 *   listen: complaintNotifEmitter.on('show', callback)
 *   cleanup: complaintNotifEmitter.off('show', callback)
 */

class ComplaintNotifEmitter {
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

const complaintNotifEmitter = new ComplaintNotifEmitter();
export default complaintNotifEmitter;

'use strict';

/**
 * Stores data.
 *
 * @type {Object}
 * @api public
 */
var data = Object.create(null);

//
// Expose a `store` like interface.
//
module.exports = {
  /**
   * Get data.
   *
   * @param {String} key Key.
   * @param {Function} fn Completion callback.
   * @api public
   */
  get: function get(key, fn) {
    setTimeout(function tick() {
      fn(undefined, data[key]);
    }, 0);
  },

  /**
   * Store data.
   *
   * @param {String} key Key.
   * @param {Mixed} value Things to store.
   * @param {Number} expire Expire time in ms.
   * @param {Function} fn Completion callback.
   * @api public
   */
  set: function set(key, value, expire, fn) {
    data[key] = value;

    setTimeout(fn, 0);
    setTimeout(function tick() {
      delete data[key];
    }, expire);
  },

  /**
   * Remove data from store.
   *
   * @param {String} key Key.
   * @param {Function} fn Completion callback
   * @api public
   */
  del: function del(key, fn) {
    delete data[key];

    setTimeout(fn, 0);
  },

  /**
   * Reset the data layer.
   *
   * @api public
   */
  reset: function reset() {
    data = Object.create(null);
  }
};

'use strict';

var Dynamis = require('dynamis')
  , crypto = require('crypto')
  , bs58 = require('bs58')
  , ms = require('ms');

/**
 * Tolkien is a authentication system that allows users to login to your system
 * without the use a password. It generates one time tokens for logging in.
 *
 * Options:
 *
 * - store: A store for the tokens. If no store is used will attempt to generate
 *   one from the options.
 * - type: Type of store to generate (redis, memcached, couchdb).
 * - client: Reference to the created store client.
 * - expire: Expire time of a generated token.
 * - namespace: Prefix the keys that we add.
 *
 * @constructor
 * @param {Object} options Configuration.
 * @api public
 */
function Tolkien(options) {
  if (!this) return new Tolkien(options);

  options = options || {};

  this.store = options.store || new Dynamis(options.type, options.client, options);
  this.expire = ms((options.expire || '5 minutes').toString());
  this.ns = options.namespace || 'tolkien:';
  this.ratelimit = options.ratelimit || 3;
  this.services = Object.create(null);
}

Tolkien.extend = require('extendible');

/**
 * Received a login attempt, validate data, store generated token and send to
 * user.
 *
 * @param {Object} data Data object with user information.
 * @param {Function} fn Completion callback.
 * @returns {Tolkien}
 * @api public
 */
Tolkien.prototype.login = function login(data, fn) {
  var service = this.services[data.service]
    , tolkien = this
    , ns = this.ns
    , id = data.id
    , err;

  if (!Object.keys(tolkien.services).length) {
    err = new Error('No authentication service configured.');
  } else if (!id) {
    err = new Error('Missing user id, cannot generate a token.');
  } else if (!data.service) {
    err = new Error('Missing authentication service.');
  } else if (!service) {
    err = new Error('Invalid or unknown authentication service selected.');
  }

  if (err) setImmediate(fn.bind(fn, err));
  else tolkien.get(data, function get(err, result) {
    if (!err && result) {
      err = new Error('Please wait until the old token expires.');
    }

    if (err) return fn(err);

    tolkien[service.type](service.size, function generated(err, token) {
      if (err) return fn(err);

      data.token = token;
      tolkien.set(data, service.expire, function stored(err) {
        if (err) return fn(err);

        service.send(data, fn);
      });
    });
  });

  return tolkien;
};

/**
 * Validate the given token.
 *
 * @param {Object} data Data object with id and token information.
 * @param {Function} fn Completion callback.
 * @returns {Tolkien}
 * @api public
 */
Tolkien.prototype.validate = function validate(data, fn) {
  var tolkien = this
    , ns = this.ns
    , err;

  if (!data.token) {
    err = new Error('Missing token, cannot validate request.');
  } else if (!data.id) {
    err = new Error('Missing user id, cannot validate token.');
  }

  if (err) setImmediate(fn.bind(fn, err));
  else this.get(data, function get(err, result) {
    if (err || !result) return fn(err, false, data);

    //
    // The get method returns the id belongs to the token or the token that
    // belongs to our given id so we need to check if both are the same in order
    // to confirm a validated id and token match. If it's invalid we don't need
    // to delete tokens as they will auto expire and we don't want to remove the
    // wrong id or token.
    //
    var validates = data.token === result.token && data.id === result.id;
    if (!validates) return fn(err, validates, data);

    tolkien.remove(data, function deleted(err) {
      fn(err, validates, data);
    });
  });

  return this;
};

/**
 * Get the token that belongs to the id or the id that belongs to the token.
 *
 * @param {Object} data Data object which has the user id or token.
 * @param {Function} fn Completion callback.
 * @returns {Tolkien}
 * @api public
 */
Tolkien.prototype.get = function get(data, fn) {
  var result = {};

  if (data.token) result.token = data.token;
  if (data.id) result.id = data.id;

  if (data.id) this.store.get(this.ns +'id:'+ data.id, function get(err, token) {
    if (!token) return fn();

    result.token = token;
    fn(err, result);
  });

  else this.store.get(this.ns + 'token:'+ data.token, function get(err, id) {
    if (!id) return fn();

    result.id = id;
    fn(err, result);
  });

  return this;
};

/**
 * Store the token and the id in the supplied store.
 *
 * @param {Object} data Data object which has the user id or token.
 * @param {Function} fn Completion callback.
 * @returns {Tolkien}
 * @api public
 */
Tolkien.prototype.set = function set(data, expire, fn) {
  var ns = this.ns
    , errors = []
    , calls = 0;

  function next(err) {
    if (err) errors.push(err);
    if (++calls === 2) fn(errors.pop(), data);
  }

  this.store.set(ns +'token:'+ data.token, data.id, expire, next);
  this.store.set(ns +'id:'+ data.id, data.token, expire, next);

  return this;
};

/**
 * Remove token and id from the store.
 *
 * @param {Object} data Data object which has the user id or token.
 * @param {Function} fn Completion callback.
 * @returns {Tolkien}
 * @api public
 */
Tolkien.prototype.remove = function remove(data, fn) {
  var ns = this.ns
    , errors = []
    , calls = 0;

  function next(err) {
    if (err) errors.push(err);
    if (++calls === 2) fn(errors.pop(), data);
  }

  this.store.del(ns +'token:'+ data.token, next);
  this.store.del(ns +'id:'+ data.id, next);

  return this;
};

/**
 * Register a new service that will be used to send the generated login token.
 *
 * The following options are accepted:
 *
 * - type: What kind of token do you want to generate? A `number` or a `token`.
 *   Numbers are ideal for SMS/TXT authentication.
 * - size: The maximum size of the token in bytes or maximum length.
 *
 * @param {String} name Name of service.
 * @param {Function} fn Callback for token and user information for sending.
 * @param {Object} options Additional configuration for your service.
 */
Tolkien.prototype.service = function service(name, fn, options) {
  options = options || {};

  var types = ['token', 'number']
    , type = options.type || 'token'
    , size = options.size || ('token' === type ? 16 : 9999);

  if (!~types.indexOf(type)) {
    throw new Error('Unknown type option ('+ type +') only accepts: '+ types.join());
  } else if ('function' !== typeof fn) {
    throw new Error('Invalid callback supplied, please make sure its a function');
  }

  this.services[name] = {
    expire: ms((options.expire || this.expire).toString()),
    size: size,
    type: type,
    send: fn
  };

  return this;
};

/**
 * Generate a new random token which we can use.
 *
 * @param {Number} size The maximum length of token in bytes.
 * @param {Function} fn Completion callback that receives the token.
 * @returns {Tolkien}
 * @api public
 */
Tolkien.prototype.token = function token(size, fn) {
  crypto.randomBytes(size, function generated(err, buffer) {
    if (err) return fn(err);

    fn(err, bs58.encode(buffer));
  });

  return this;
};

/**
 * Generate a new number which we can use SMS authentication as it's much easier
 * to type on a phone. We already know that the user is owner of the phone so it
 * doesn't matter if this is bit less cryptographically strong then a generated
 * email token.
 *
 * @param {Number} size The maximum length of token in bytes.
 * @param {Function} fn Completion callback that receives the token.
 * @returns {Tolkien}
 * @api public
 */
Tolkien.prototype.number = function number(max, fn) {
  crypto.randomBytes(4, function generated(err, buffer) {
    if (err) return fn(err);

    fn(err, Math.floor(buffer.readUInt32BE(0) % max));
  });

  return this;
};

//
// Expose the module.
//
module.exports = Tolkien;

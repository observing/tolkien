/* istanbul ignore next */
describe('tolkien', function () {
  'use strict';

  var memory = require('./memory')
    , assume = require('assume')
    , Tolkien = require('./')
    , tolkien;

  beforeEach(function () {
    tolkien = new Tolkien({ store: memory });
  });

  afterEach(function () {
    memory.reset();
  });

  it('exposes a function', function () {
    assume(Tolkien).is.a('function');
  });

  it('can be constructed without `new` keyword', function () {
    assume(Tolkien({ store: memory })).is.instanceOf(Tolkien);
  });

  it('accepts a redis store through dynamis', function () {
    tolkien = new Tolkien({
      type: 'redis',
      client: require('redis').createClient(),
      database: 'tokens'
    });
  });

  it('can be extended', function () {
    assume(Tolkien.extend).is.a('function');

    var Token = Tolkien.extend({
      token: function token() {
      }
    });

    assume(Token.prototype.token).does.not.equal(Tolkien.prototype.token);
    assume(new Token({ store: memory })).is.instanceOf(Tolkien);
    assume(new Token({ store: memory })).is.instanceOf(Token);
  });

  it('accepts strings are expire value', function () {
    tolkien = new Tolkien({ store: memory, expire: '1 second' });

    assume(tolkien.expire).equals(1000);
  });

  describe('#service', function () {
    it('adds a new service', function () {
      assume('foo' in tolkien.services).is.false();

      tolkien.service('foo', function () {}, { type: 'token' });
      assume('foo' in tolkien.services).is.true();

      var service = tolkien.services.foo;
      assume(service.type).equals('token');
    });

    it('defaults to `token` as type', function () {
      tolkien.service('foo', function () {});

      var service = tolkien.services.foo;

      assume(service.type).equals('token');
      assume(service.expire).equals(tolkien.expire);
    });

    it('throws on unknown types', function (next) {
      try { tolkien.service('foo', function () {}, { type: 'foo' }); }
      catch (e) {
        assume(e.message).includes('type');
        assume(e.message).includes('foo');

        next();
      }
    });

    it('throws on invalid functions', function (next) {
      try { tolkien.service('foo', { type: 'foo' }); }
      catch (e) {
        assume(e.message).includes('callback');
        assume(e.message).includes('function');

        next();
      }
    });

    it('returns it self so we can chain', function () {
      tolkien.service('foo', function () {})
             .service('bar', function () {})
             .service('baz', function () {});
    });

    it('allows a custom expire', function () {
      tolkien.service('foo', function () {}, { expire: '3 minutes' });

      var service = tolkien.services.foo;

      assume(service.type).equals('token');
      assume(service.expire).equals(180000);
    });
  });

  describe('#set, #get', function () {
    it('stores the data', function (next) {
      tolkien.set({ id: 'foo', token: 'bar' }, 10, next);
    });

    it('can be retrieved', function (next) {
      var data = { token: 'world' };

      tolkien.set(data, 100, function (err, data) {
        if (err) return next(err);

        assume(data.token).equals('world');

        tolkien.get({ token: 'bar' }, function (err) {
          if (err) return next(err);

          assume(data.token).equals('world');
          assume(data.id).equals('foo');

          next();
        });
      });
    });

    it('stores duplicate entries for user and token lookup', function (next) {
      var data = { id: 'get', token: 'set' };

      tolkien.set(data, 100, function (err, data) {
        if (err) return next(err);

        assume(data.token).equals('set');
        assume(data.id).equals('get');

        var token = tolkien.ns + 'token:set'
          , id = tolkien.ns + 'id:get';

        tolkien.store.get(token, function (err, user) {
          if (err) return next(err);

          assume(user).equals('get');

          tolkien.store.get(id, function (err, toki) {
            if (err) return next(err);
            assume(toki).equals('set');

            next();
          });
        });
      });
    });
  });

  describe('#remove', function () {
    it('removes both the id and token entries', function (next) {
      var data = { id: 'haai', token: 'baii' };

      tolkien.set(data, 100, function (err) {
        if (err) return next(err);

        var token = tolkien.ns + 'token:baii'
          , id = tolkien.ns + 'id:haai';

        tolkien.remove(data, function (err) {
          if (err) return next(err);

          tolkien.store.get(token, function (err, user) {
            if (err) return next(err);

            assume(user).is.a('undefined');

            tolkien.store.get(id, function (err, toki) {
              if (err) return next(err);
              assume(toki).is.a('undefined');

              next();
            });
          });
        });
      });
    });
  });

  describe('#login', function () {
    it('calls with error if no services are configured', function (next) {
      tolkien.login({}, function (err) {
        assume(err.message).includes('No');
        assume(err.message).includes('service');
        assume(err.message).includes('.');

        next();
      });
    });

    it('calls with error if service key is missing', function (next) {
      tolkien.service('foo', function () {});
      tolkien.login({ id: 'foo' }, function (err) {
        assume(err.message).includes('Missing');
        assume(err.message).includes('service');
        assume(err.message).includes('.');

        next();
      });
    });

    it('calls with error if id is missing', function (next) {
      tolkien.service('foo', function () {});
      tolkien.login({ service: 'foo' }, function (err) {
        assume(err.message).includes('Missing user id');
        assume(err.message).includes('.');

        next();
      });
    });

    it('calls with error if unknown service is selected', function (next) {
      tolkien.service('foo', function () {});
      tolkien.login({ service: 'bar', id: '1313' }, function (err) {
        assume(err.message).includes('unknown');
        assume(err.message).includes('service');
        assume(err.message).includes('.');

        next();
      });
    });

    it('does not allow creation of tokens if token is pending', function (next) {
      tolkien.service('foo', function () {});

      var data = { id: 'afadafafds', service: 'foo' };

      // Add a "token" to the database
      tolkien.set({ id: data.id, token: 'bar' }, 100, function (err) {
        if (err) return next(err);

        tolkien.login(data, function (err) {
          assume(err.message).contains('expires');

          next();
        });
      });
    });

    it('calls the callback of the selected service with the supplied data', function (next) {
      tolkien.service('foo', function (data, fn) {
        assume(data).is.a('object');
        assume(fn).is.a('function');

        assume(data.service).equals('foo');
        assume(data.id).equals('user-id');
        assume(data.token).is.a('string');

        fn();
      });

      tolkien.login({ service: 'foo', id: 'user-id' }, next);
    });

    it('receives the generated tokens and supplied data as argument', function (next) {
      tolkien.service('foo', function (data, fn) {
        assume(data).is.a('object');
        assume(fn).is.a('function');

        assume(data.service).equals('foo');
        assume(data.id).equals('user-id');
        assume(data.token).is.a('string');
        data.foo = 'bar';

        fn(undefined, 'response lol');
      });

      tolkien.login({ service: 'foo', id: 'user-id' }, function (err, data) {
        assume(data.service).equals('foo');
        assume(data.token).is.a('string');
        assume(data.id).equals('user-id');
        assume(data.response).equals('response lol');

        next();
      });
    });
  });

  describe('#validate', function () {
    it('requires a token in the data', function (next) {
      tolkien.service('foo', function () {});
      tolkien.validate({ id: 'hi' }, function (err) {
        assume(err.message).contains('Missing token');

        next();
      });
    });

    it('requires a user in the data', function (next) {
      tolkien.service('foo', function () {});
      tolkien.validate({ token: 'hi' }, function (err) {
        assume(err.message).contains('Missing user');

        next();
      });
    });

    it('does not validate when we dont have any data', function (next) {
      tolkien.service('foo', function () {});
      tolkien.validate({ id: 'a', token: 'b' }, function (err, valid, data) {
        if (err) return next(err);

        assume(valid).is.false();
        assume(data.id).equals('a');
        assume(data.token).equals('b');

        next();
      });
    });

    it('does not validate if the token expired', function (next) {
      tolkien.service('foo', function () {});
      tolkien.set({ id: 'a', token: 'b' }, 1, function () {
        setTimeout(function () {
          tolkien.validate({ id: 'a', token: 'b' }, function (err, valid, data) {
            if (err) return next(err);

            assume(valid).is.false();
            assume(data.id).equals('a');
            assume(data.token).equals('b');

            next();
          });
        }, 1200);
      });
    });

    it('has validates if the token equals stored token', function (next) {
      tolkien.service('foo', function () {});
      tolkien.set({ id: 'one', token: 'two' }, 100, function () {
        tolkien.validate({ id: 'one', token: 'three' }, function (err, valid, data) {
          if (err) return next(err);

          assume(valid).is.false();
          assume(data.id).equals('one');
          assume(data.token).equals('three');

          next();
        });
      });
    });

    it('validates if the token is valid', function (next) {
      tolkien.service('foo', function () {});
      tolkien.set({ id: 'two', token: 'four' }, 1000, function (err) {
        if (err) return next(err);

        tolkien.validate({ id: 'two', token: 'four' }, function (err, valid, data) {
          if (err) return next(err);

          assume(valid).is.true();
          assume(data.id).equals('two');
          assume(data.token).equals('four');

          tolkien.get(data, function (err, res) {
            assume(err).is.a('undefined');
            assume(res).is.a('undefined');

            next();
          });
        });
      });
    });
  });

  describe('#token', function () {
    it('generates a string', function (next) {
      tolkien.token(10, function (err, token) {
        if (err) return next(err);

        assume(token).is.a('string');
        next();
      });
    });

    it('is async', function (next) {
      var foo = 'foo';

      assume(tolkien.token(10, function (err, token) {
        foo = 'bar';

        if (err) return next(err);

        assume(token).is.a('string');
        next();
      })).equals(tolkien);

      assume(foo).equals('foo');
    });
  });

  describe('#number', function () {
    it('generates a string', function (next) {
      tolkien.number(9999, function (err, token) {
        if (err) return next(err);

        assume(token).is.a('number');
        next();
      });
    });

    it('is async', function (next) {
      var foo = 'foo';

      assume(tolkien.number(10, function (err, token) {
        foo = 'bar';

        if (err) return next(err);

        assume(token).is.a('number');
        next();
      })).equals(tolkien);

      assume(foo).equals('foo');
    });
  });
});

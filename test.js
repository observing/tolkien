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

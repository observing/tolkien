# tolkien

## Installation

```
npm install --save tolkien
```

## Usage

In all examples we assume that you've already required the module as following:

```js
'use strict';

var Tolkien = require('tolkien');
```

Now that you've required the `Tolkien` module we need to initialize it. The
`Tolkien` constructor allows one single argument which an options object which
allows you to configure all the things. One of the most important things you
need to configure is the store where we can save the generated tokens etc. There
are two ways to provide us with a store:

1. Provide a store using the `store` property. (The store you supply should have
   a `get(key, fn)`, `set(key, value, expire-ms, fn)` and `del(key, fn)` interface)
2. Have the module configure a store for us. We use [Dynamis] as store wrapper.
   This requires use of the `type` and `client` properties.

```js
//
// Example of a dead simple custom memory store.
// @see ./memory.js
//
var data = Object.create(null);

var tolkien = new Tolkien({
  store: {
    get: function (key, fn) {
      setTimeout(function () {
        fn(undefined, data[key]);
      }, 0);
    },

    set: function (key, value, expire, fn) {
      data[key] = value;

      setTimeout(fn, 0);

      setTimeout(function () {
        delete data[key];
      }, expire);
    },

    del: function (key, fn) {
      delete data[key];

      setTimeout(fn, 0);
    }
  }
});

//
// Or using dynamis interface.
//
var redis = require('redis')
  , client = redis.createClient();

var tolkien = new Tolkien({ type: 'redis', client: redis });
```

But a store isn't the only thing you can configure. Here are all the different
options that we accept:

- `store`, A store object which we can use to store the token.
- `type`, The type of store we should generate using [Dynamis]. It can be
  `redis`, `memcached` or `couchdb`.
- `client`,  Reference to the client that [Dynamis] needs to wrap.
- `namespace`, The prefix for all keys that we add in the store. Defaults to
  `tolkien:`.
- `expiree`, Time that people have from generation of a token to using the
  token. Can be human readable string which is parsed by the `ms` module or
  a number which represents the amount of milliseconds it can take. Defaults to
  `5 minutes`.

## License

MIT

[Dynamis]: https://github.com/Moveo/dynamis

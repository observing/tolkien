# tolkien

[![Version npm][version]](http://browsenpm.org/package/tolkien)[![Build Status][build]](https://travis-ci.org/observing/tolkien)[![Dependencies][david]](https://david-dm.org/observing/tolkien)[![Coverage Status][cover]](https://coveralls.io/r/observing/tolkien?branch=master)

[version]: http://img.shields.io/npm/v/tolkien.svg?style=flat-square
[build]: http://img.shields.io/travis/observing/tolkien/master.svg?style=flat-square
[david]: https://img.shields.io/david/observing/tolkien.svg?style=flat-square
[cover]: http://img.shields.io/coveralls/observing/tolkien/master.svg?style=flat-square

[Passwords are obsolete][obsolete]. If you haven't read this blog post yet, it
should be the first thing you do today. It's the concept which made this module
a reality.

`tolkien implements one time token authorization which renders passwords
obsolete. Instead of signing in to a service using a username and password you
sign in using a token that get's send to you using (email, sms, whatever) and
once click the link/use the token you're authenticated. That's it.

- You never have to store, crypte, hash and salt passwords again.
- There is no need for forgot password and resets, everytime you need to
  authenticate it sends you a new token.
- Passwords can be changed without interaction of the service.
- 1 input for registering and logging in. This lowers the barrier for sign-ups.
- No passwords to remember, to generate and store. While solutions are 1Password
  are great they do not solve the issue nor does everybody on the web use them.
- SPAM/Scam free, ever got those phishing emails from sites asking for your user
  name and passworld and secretly steal all your information? Yes, that's a
  thing of the past.
- It's super flexible, it's not just sending tokens through email but things
  like SMS or even snail mail are possible.
- Want two factor auth? Send tokens using multiple services (email and SMS).

![YOU SHALL NOT PASS](http://media.giphy.com/media/njYrp176NQsHS/giphy.gif)

**High five if you understood this reference**

## Installation

This module is released in the public npm registry and can be installed using:

```
npm install --save tolkien
```

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
  - [tolkien.service](#tolkienservice)
  - [tolkien.login](#tolkienlogin)
  - [tolkien.validate](#tolkienvalidate)
  - [tolkien.get](#tolkienget)
  - [tolkien.set](#tolkienset)
  - [tolkien.remove](#tolkienremove)
- [FAQ](#faq)
- [License](#license)

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
// @see ./memory.js in the root of this repository.
//
var data = Object.create(null);

var tolkien = new Tolkien({
  store: require('./memory');
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

- **`store`**, A store object which we can use to store the token.
- **`type`**, The type of store we should generate using [Dynamis]. It can be
  `redis`, `memcached` or `couchdb`.
- **`client`**,  Reference to the client that [Dynamis] needs to wrap.
- **`namespace`**, The prefix for all keys that we add in the store. Defaults to
  `tolkien:`.
- **`expire`**, Time that people have from generation of a token to using the
  token. Can be human readable string which is parsed by the `ms` module or
  a number which represents the amount of milliseconds it can take. Defaults to
  `5 minutes`.

### tolkien.service

Tolkien comes without any services configured by default as this service you
want to use usually specific to your application and requires further
configuration. Luckily registering new services is dead simple. To add a new
service simply call the `service` method with the following arguments:

1. `name`, A unique name of the service you're about to add. This name is later
   used by you to tell us which service we should use to send the one time
   authorization token.
2. `callback`, This callback will be called every time someone needs to receive
   a token. The callback will receive 2 arguments:
   1. `data`, An object which contains the `token`, `id` and all other extra
      properties you passed in to the [`tolkien.login`](login) method.
   2. `next`, Completion callback for when you've send the token to the user.
      This callback assumes an error first pattern.
3. `options`, Optional object which allows you to further configure the service.
   You can specify the following options:
   - `type` What kind token do you want to receive. It can either be a **token**
     which is cryptographically generated base58 string or **number** which is
     cryptographically generated random number which is ideal for SMS/TXT
   services. We default to `token` if no option is provided.
   - `size` If you've selected **token** as type this is the amount of bytes we
     need to generate for the token. And it will default to `16`. If you've
     selected **number** as type it will be the maximum number that can be
     generated. This defaults to `9999`.
   - `expire`, Optional expire for the generated tokens. Some methods take more
     time then others so you can use a custom timeout here (maybe you want to
     send the generated token through snail mail ;-)). This defaults to the
     value you've set in the constructor using the `expire` option.

```js
//
// An example to setup email sending using the Mandrill e-mail service from
// Mailchip.
//
var mandrill = require('node-mandrill')(process.env.MANDRILL_API_KEY);

tolkien.service('email', function email(data, fn) {
  mandrill('/messages/send', {
    message: {
      to: [{ email: data.email, name: data.name }],
      from_email: 'login@example.org',
      subject: 'Hey, your example.org access-token!',
      text: [
        'ohai '+ data.name +'!',
        'click the following link to login to your account:',
        'http://example.com?token='+ data.token +'&id'+ data.id,
      ].join('\n');
    }
  }, fn);
}, { type: 'token' });
```

The `data.token` is automatically generated by us. All the other properties are
passed in to the [`tolkien.login(data, fn)`][login] method.

There is no limit to the amount of services you wish to configure nor is there a
limitation on the types of services you want to generate. You could send the
generated token using:

- Email
- Text message
- Automated phone calls
- Social network direct messages (Twitter)
- IRC, WhatsApp and other chat apps.

The possibilities are endless!

### tolkien.login

Now that you have the services configured you can start handling login attempts.
This is done by calling the login method. It requires 2 arguments:

1. `data`, A object that contains a `service` property with the name of a
   configured service and a `id` property which is the id of the user that wants
   to authenticate. All other keys that you add will automatically be passed in
   to service's callback function. Please note that this method automatically
   adds a `token` property to the supplied object so any existing `token`
   properties will be overridden.
2. `fn`, A completion callback which follows the error first pattern. There a
   couple of reasons on why a login can fail:
   - You have no services configured.
   - The id or service property is missing.
   - You specified an unknown service name.
   - The user still has a pending token that needs to expire.
   - Token generation failed.
   - Service failed.
   - Storing failed.
   - Retrieving from storage failed.

In the list of errors you might have noticed that an operation can fail if the
user already has a pending token. This might sounds odd but it's intentional.
The reason for this is to simply prevent multiple login attempts to happen and
it protects you users against spam.

```js
tolkien.login({
  service: 'email',
  id: 'foobar'
}, function (err, data) {
  // Do stuffs
});
```

If you want to handle logins through express / http requests you could do
something like:

```js
app.post('/login', function (req, res) {
  if (!req.body.email) return res.end('missing email');

  lookupOrRegister(req.body.email, function (err, id) {
    if (err) return res.end('Failed things, '+ err.message);

    tolkien.login({ 
      service: 'email',
      id: id,
      to: req.body.email
    }, function (err) {
      if (err) return res.end('Failed things, '+ err.message);

      res.end('Check your email '+ req.body.email +' for your login token');
    });
  });
});
```

## tolkien.validate

After sending tokens we also need a way to validate them. This is done using the
`validate` method. You should call this when you've received the generated
`token` and `id` from your user. It requires 2 arguments:

1. `data`, A data object which contains a `token` and `id` property which
   contains the values that you received from the user.
2. `fn`, A completion callback which follows the error first pattern. You can
   receive an error when:
   - The token or id is missing from the data object.
   - We failed to retrieve the data from the storage layer.
   - We failed to remove the token from the storage layer.
   Please do note that an error does not always indicate that a user has also
   failed to validate as we only remove token after we've validated the incoming
   data so you should always check the `validation` argument of this callback.

```js
tolkien.validate({ token: 'foo', id: 'bar' }, function (err, validates, data) {
  // validates: Boolean indicating if the credentials are correct.
  // data: Reference to the object you passed in the validate function.
  // err: Thinks broke.
});
```

If you want to handle logins through express / http requests you could do
something like:

```js
app.get('/auth', function (req, res) {
  if (!req.query.id || !req.query.token) return res.end('Missing required params');
 
  tolkien.validate(req.query, function (err, validates, data) {
    if (!validates) res.redirect('/login'); // Login again

    req.session.id = data.id;
    res.end('Successfully logged in');
  });
});
```

### tolkien.get

**Please note this is a private API - but might still be useful for you.**

Helper function which will retrieve the data from the storage layer. If the
supplied object only has a token it will search the id, if it has an id it will
search the token.

```js
tolkien.get({ id: 'foo' }, function (err, data) {
  console.log(data.id);    // foo
  console.log(data.token); // bar
});
```

### tolkien.set

**Please note this is a private API - but might still be useful for you.**

Helper function which will add the data to the storage layer.

```js
tolkien.set({ id: 'foo', token: 'bar' }, expiree, function (err, data) {
  console.log(data.id);    // foo
  console.log(data.token); // bar
});
```

### tolkien.remove

**Please note this is a private API - but might still be useful for you.**

Remove the token and id from the data layer.

```js
tolkien.remove({ id: 'foo', token: 'bar' }, function (err, data) {
  console.log(data.id);    // foo
  console.log(data.token); // bar
});
```

## FAQ

Frequently Asked Questions:

### How do I handle registration or send a different e-mail for registration?

Tolkien sees no difference between registration and login as both actions
require the interactions: Supplying us with a user id and then send the token.
But this does not mean that **you** as developer cannot tell the difference. We
directly pass the provided object from the [`tolkin.login`][login] in to your
configured service so you can add extra property like `registration: true` to
the data object and send a different message.

```js
tolkien.service('email', function email(data, fn) {
  var template;

  //
  // FYI: Don't fs.readFileSync in production, this is merely for illustrative
  // purposes.
  //
  if (data.registration) {
    template = fs.readFileSync(__dirname +'/registration.txt', 'utf-8');
  } else {
    template = fs.readFileSync(__dirname +'/login.txt', 'utf-8');
  }

  // use the Templatetron3000 to compile our template..
  template = template.replace('{token}', data.token)
                     .replace('{id}', data.id);

  youremailmodulefunction(template, data.to, fn);
});

tolkien.login({ 
  service: 'email',           // Use the `email` service.
  registration: true,         // Checked in the service.
  id: 'sp3c14lus3r1d',        // Required.
  to: 'hooman@example.com'    // Address we want to email to, used the service.
}, function send(err) {
  if (err) return retrylogin(err);

  console.log('yay, token send');
});
```

### I want to use a custom token generator, how is this possible.

This is definitely possible. We have a special `.extend` property on our
constructor which allows you create your own custom Tolkien instances and your
own custom token generation methods. If you want to create custom token type
generator you can do:

```js
var Gandalf = Tolkien.extend({
  // size is the amount of bytes the service needs for the token.
  token: function generator(size, fn) {
    hardcorecryptoactiontron3000(size, function (err, data) {
      fn(err, data.toString('hex'));
    });
  }
});

var tolkien = new Gandalf({ store: require('./memory') });
```

And to custom number generator you can do:

```js
var Gandalf = Tolkien.extend({
  // size is the maximum number set the service.
  number: function generator(size, fn) {
    customcryptonumbergeneratorcurveninja(size, fn);
  }
});

var tolkien = new Gandalf({ store: require('./memory') });
```

## License

MIT

[Dynamis]: https://github.com/Moveo/dynamis
[login]: #tolkienlogin
[obsolete]: https://medium.com/@ninjudd/passwords-are-obsolete-9ed56d483eb

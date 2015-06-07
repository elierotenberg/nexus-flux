'use strict';

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

var _lifespan = require('lifespan');

var _lifespan2 = _interopRequireDefault(_lifespan);

var _remutable = require('remutable');

var _remutable2 = _interopRequireDefault(_remutable);

var _adaptersLocal = require('./adapters/Local');

var _sha256 = require('sha256');

var _sha2562 = _interopRequireDefault(_sha256);

var _ = require('lodash');
var should = require('should');
var Promise = (global || window).Promise = require('bluebird');
var __DEV__ = process.env.NODE_ENV !== 'production';
var __PROD__ = !__DEV__;
var __BROWSER__ = typeof window === 'object';
var __NODE__ = !__BROWSER__;
if (__DEV__) {
  Promise.longStackTraces();
  Error.stackTraceLimit = Infinity;
}

var stores = {};

var server = new _adaptersLocal.Server(stores);
var client = new _adaptersLocal.Client(server);

server.lifespan.onRelease(function () {
  return console.log('server released');
});
client.lifespan.onRelease(function () {
  return console.log('client released');
});

// server main
_.defer(function () {
  // initialize several stores
  var clock = stores['/clock'] = new _remutable2['default']({
    date: Date.now()
  });
  var todoList = stores['/todoList'] = new _remutable2['default']({});

  // update clock every 500ms
  server.lifespan.setInterval(function () {
    server.dispatchUpdate('/clock', clock.set('date', Date.now()).commit());
  }, 500);

  var actions = {
    '/addItem': function addItem(_ref) {
      var name = _ref.name;
      var description = _ref.description;
      var ownerKey = _ref.ownerKey;

      var item = { name: name, description: description, ownerHash: (0, _sha2562['default'])(ownerKey) };
      if (todoList.get(name) !== void 0) {
        return;
      }
      server.dispatchUpdate('/todoList', todoList.set(name, item).commit());
    },
    '/removeItem': function removeItem(_ref2) {
      var name = _ref2.name;
      var ownerKey = _ref2.ownerKey;

      var item = todoList.get(name);
      if (item === void 0) {
        return;
      }
      var ownerHash = item.ownerHash;

      if ((0, _sha2562['default'])(ownerKey) !== ownerHash) {
        return;
      }
      server.dispatchUpdate('/todoList', todoList.set(name, void 0).commit());
    }
  };

  server.on('action', function (_ref3) {
    var path = _ref3.path;
    var params = _ref3.params;

    if (actions[path] !== void 0) {
      actions[path](params);
    }
  }, server.lifespan);

  // release the server in 10000ms
  server.lifespan.setTimeout(server.lifespan.release, 10000);
});

// client main
_.defer(function () {
  var ownerKey = (0, _sha2562['default'])('' + Date.now() + ':' + _.random());
  // subscribe to a store
  client.getStore('/clock', client.lifespan)
  // every time its updated (including when its first fetched), display the modified value (it is an Immutable.Map)
  .onUpdate(function (_ref4) {
    var head = _ref4.head;

    console.log('clock tick', head.get('date'));
  })
  // if its deleted, then do something appropriate
  .onDelete(function () {
    console.log('clock deleted');
  });

  // this store subscribers has a limited lifespan (eg. a React components' own lifespan)
  var todoListLifespan = new _lifespan2['default']();
  var todoList = client.getStore('/todoList', todoListLifespan)
  // when its updated, we can access not only the up-to-date head, but also the underlying patch object,
  .onUpdate(function (_ref5, patch) {
    var head = _ref5.head;

    // if we want to do something with it (we can just ignore it as above)
    console.log('received todoList patch:', patch);
    console.log('todoList head is now:', head.toJS());
  }).onDelete(function () {
    console.log('todoList deleted');
  });
  // dispatch some actions
  client.dispatchAction('/addItem', { name: 'Harder', description: 'Code harder', ownerKey: ownerKey });
  // force resync
  client.forceResync();

  client.dispatchAction('/addItem', { name: 'Better', description: 'Code better', ownerKey: ownerKey });
  client.lifespan
  // add a new item in 1000ms
  .setTimeout(function () {
    return client.dispatchAction('/addItem', { name: 'Faster', description: 'Code Faster', ownerKey: ownerKey });
  }, 1000)
  // remove an item in 2000ms
  .setTimeout(function () {
    return client.dispatchAction('/removeItem', { name: 'Harder', ownerKey: ownerKey });
  }, 2000)
  // add an item in 3000ms
  .setTimeout(function () {
    return client.dispatchAction('/addItem', { name: 'Stronger', description: 'Code stronger', ownerKey: ownerKey });
  }, 3000)
  // remove every item in 4000
  .setTimeout(function () {
    return todoList.value.forEach(function (_ref6, name) {
      var description = _ref6.description;

      void description;
      client.dispatchAction('/removeItem', { name: name, ownerKey: ownerKey });
    });
  }, 4000)
  // release the subscriber in 5000ms
  .setTimeout(todoListLifespan.release, 5000)
  // release the client in 6000ms
  .setTimeout(client.lifespan.release, 6000);
});
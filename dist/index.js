'use strict';

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

_Object$defineProperty(exports, '__esModule', {
  value: true
});

var _Client = require('./Client');

var _Client2 = _interopRequireDefault(_Client);

var _lifespan = require('lifespan');

var _lifespan2 = _interopRequireDefault(_lifespan);

var _remutable = require('remutable');

var _remutable2 = _interopRequireDefault(_remutable);

var _Server = require('./Server');

var _Server2 = _interopRequireDefault(_Server);

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
exports['default'] = {
  Client: _Client2['default'],
  Lifespan: _lifespan2['default'],
  Remutable: _remutable2['default'],
  Server: _Server2['default'] };
module.exports = exports['default'];
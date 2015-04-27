'use strict';

var _interopRequireDefault = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _Client = require('./Client');

var _Client2 = _interopRequireDefault(_Client);

var _Lifespan = require('lifespan');

var _Lifespan2 = _interopRequireDefault(_Lifespan);

var _Remutable = require('remutable');

var _Remutable2 = _interopRequireDefault(_Remutable);

var _Server = require('./Server');

var _Server2 = _interopRequireDefault(_Server);

require('babel/polyfill');
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
  Lifespan: _Lifespan2['default'],
  Remutable: _Remutable2['default'],
  Server: _Server2['default'] };
module.exports = exports['default'];
const createEvents = require('strict-events');

const Client = require('./Client');

const EVENTS = {
  HANDSHAKE_ACK: 'h',
  UPDATE: 'u',
  DELETE: 'd',
};

const Events = createEvents(EVENTS);

let _Server;

class Store {
  constructor(path, server) {
    if(__DEV__) {
      path.should.be.a.String;
      server.should.be.an.instanceOf(_Server);
    }
  }

  get head() {

  }

  get working() {

  }

  set(key, value) {
    if(__DEV__) {
      key.should.be.a.String;
    }
  }

  commit() {

    this._server.handleStoreCommit(this._path, this._head, patch);
  }

  delete() {

    this._server.handleStoreDelete(this._path);
  }
}

class Action {
  constructor(path, server) {
    if(__DEV__) {
      path.should.be.a.String;
      server.should.be.an.instanceOf(_Server);
    }
  }

  onDispatch(handler) {
    if(__DEV__) {
      handler.should.be.a.Function;
    }
  }

  _dispatch(params = {}) {
    if(__DEV__) {
      params.should.be.an.Object;
    }

    this._server.handleActionDispatch(this._path, params);
  }
}

class Server {
  constructor({ push }, opts = {}) {
    if(__DEV__) {
      push.should.be.a.Function;
      opts.should.be.an.Object;
    }
    _.bindAll(this);
    Object.assign(this, {
      _push: push,
      _stores: {},
      _actions: {},
    });
  }

  open(clientSecret, { clientListener, clientEmitter }) {
    if(__DEV__) {
      clientSecret.should.be.a.String;
      clientListener.should.be.an.instanceOf(Client.Events.Listener);
      clientEmitter.should.be.an.instanceOf(Client.Events.Emitter);
    }
  }

  close(clientSecret) {
    if(__DEV__) {
      clientSecret.should.be.a.String;
    }
  }

  Store(path) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    if(this._stores[path] === void 0) {
      this._stores[path] = new Store(path, this);
    }
    return this._stores[path];
  }

  Action(path) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    if(this._actions[path] === void 0) {
      this._actions[path] = new Action(path, this);
    }
    return this._actions[path];
  }

  handleStoreCommit(path, head, patch) {
  }

  handleStoreDelete(path) {

  }

  handleActionDispatch(path, params) {

  }
}

_Server = Server;

Object.assign(Server.prototype, {
  _push: null,
  _stores: null,
  _actions: null,
});

Object.assign(Server, { EVENTS, Events });

module.exports = Server;

const createEvents = require('strict-events');

const Server = require('./Server');

const EVENTS = {
  HANDSHAKE: 'h',
  SUBSCRIBE: 's',
  UNSUBSCRIBE: 'u',
  DISPATCH: 'd',
};

const Events = createEvents(EVENTS);

let _Client;

class Store {
  constructor(path, client) {
    if(__DEV__) {
      path.should.be.a.String;
      client.should.be.an.instanceOf(_Client);
    }
  }

  fetch() {

  }

  onChange(handler) {
    if(__DEV__) {
      handler.should.be.a.Function;
    }
  }

  onDelete(handler) {
    if(__DEV__) {
      handler.should.be.a.Function;
    }
  }
}

class Action {
  constructor(name, client) {
    if(__DEV__) {
      name.should.be.a.String;
      client.should.be.an.instanceOf(_Client);
    }
  }

  dispatch(params = {}) {
    if(__DEV__) {
      params.should.be.an.Object;
    }

  }
}

class Client {
  constructor({ pull }, opts = {}) {
    if(__DEV__) {
      pull.should.be.a.Function;
      opts.should.be.an.Object;
    }
    _.bindAll(this);
    Object.assign(this, {
      _pull: pull,
      _stores: {},
      _actions: {},
    });
  }

  open(serverSecret, { serverListener, serverEmitter }) {
    if(__DEV__) {
      serverListener.should.be.an.instanceOf(Server.Events.Listener);
      serverEmitter.should.be.an.instanceOf(Server.Events.Emitter);
    }
  }

  close({ serverSecret }) {
    if(__DEV__) {
      serverSecret.should.be.a.String;
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
}

_Client = Client;

Object.assign(Client.prototype, {
  _pull: null,
  _stores: null,
  _actions: null,
});

Object.assign(Events, { EVENTS, Events });

module.exports = Client;

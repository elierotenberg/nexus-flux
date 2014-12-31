const createEventsClass = require('strict-events');

// There as 2 executions environments: the client and the server.
// There are 3 roles:
// - Library (this package)
// - User (typically an application)
// - Adapter (React Nexus Uplink or React Nexus Memory or React Nexus LocalStorage)


const SERVER_EVENTS = {
  OPEN: 'o',
  UPDATE: 'u',
  DELETE: 'd',
  CLOSE: 'c',
};

// Abstract Store Interface

const STORE_EVENTS = {
  'SET',
  'DELETE',
};

const StoreInterface = createEventsClass(STORE_EVENTS);

// Store: Client as user, Server as library
Object.assign(StoreInterface.Listener.prototype, {
  onSet: _.partial(StoreInterface.Listener.prototype.on, STORE_EVENTS.SET),
  offSet: _.partial(StoreInterface.Listener.prototype.off, STORE_EVENTS.SET),
  onDelete: _.partial(StoreInterface.Listener.prototype.on, STORE_EVENTS.DELETE),
  offDelete: _.partial(StoreInterface.Listener.prototype.off, STORE_EVENTS.DELETE),
});

// Store: Client as library, Server as user
Object.assign(StoreInterface.Emitter.prototype, {
  set: _.partial(StoreInterface.Emitter.prototype.trigger, STORE_EVENTS.SET),
  delete: _.partial(StoreInterface.Emitter.prototype.trigger, STORE_EVENTS.DELETE),
});

Object.assign(StoreInterface, {
  inClient: {
    asUser: StoreInterface.Listener,
    asLibrary: StoreInterface.Emitter,
  },
  inServer: {
    asUser: StoreInterface.Emitter,
    asLibrary: StoreInterface.Listener,
  },
});

// Abstract Action Interface

const ACTION_EVENTS = {
  'DISPATCH',
};

const ActionInterface = createEventsClass(ACTION_EVENTS);

// Action: Client as library, Server as user
Object.assign(ActionInterface.Listener.prototype, {
  onDispatch: _.partial(ActionInterface.Listener.prototype.on, ACTION_EVENTS.DISPATCH),
  offDispatch: _.partial(ActionInterface.Listener.prototype.off, ACTION_EVENTS.DISPATCH),
});

// Action: Client as user, Server as library
Object.assign(ActionInterface.Emitter.prototype, {
  dispatch: _.partial(ActionInterface.Emitter.prototype.trigger, ACTION_EVENTS.DISPATCH),
});

Object.assign(ActionInterface, {
  inClient: {
    asUser: ActionInterface.Emitter,
    asLibrary: ActionInterface.Listener,
  },
  inServer: {
    asUser: ActionInterface.Listener,
    asLibrary: ActionInterface.Emitter,
  },
});

// Abstract Client Interface

const CLIENT_EVENTS = {
  OPEN: 'o',
  SUBSCRIBE: 's',
  UNSUBSCRIBE: 'u',
  DISPATCH: 'd',
};

const ClientInterface = createEventsClass(CLIENT_EVENTS);

// Client: Client as adapter, Server as library
Object.assign(ClientInterface.Listener.prototype, {
  onOpen: _.partial(ClientInterface.Listener.prototype.on, CLIENT_EVENTS.OPEN),
  offOpen: _.partial(ClientInterface.Listener.prototype.off, CLIENT_EVENTS.OPEN);
  onSubscribe: _.partial(ClientInterface.Listener.prototype.on, CLIENT_EVENTS.SUBSCRIBE),
  offSubscribe: _.partial(ClientInterface.Listener.prototype.off, CLIENT_EVENTS.SUBSCRIBE),
  onUnsubscribe: _.partial(ClientInterface.Listener.prototype.on, CLIENT_EVENTS.UNSUBSCRIBE),
  offUnsubscribe: _.partial(ClientInterface.Listener.prototype.off, CLIENT_EVENTS.UNSUBSCRIBE),
  onDispatch: _.partial(ClientInterface.Listener.prototype.on, CLIENT_EVENTS.DISPATCH),
  offDispatch: _.partial(ClientInterface.Listener.prototype.off, CLIENT_EVENTS.DISPATCH),
});

// Client: Client as library, Server as adapter
Object.assign(ClientInterface.Emitter.prototype, {
  open: _.partial(ClientInterface.Emitter.prototype.trigger, CLIENT_EVENTS.OPEN),
  close: _.partial(ClientInterface.Emitter.prototype.trigger, CLIENT_EVENTS.CLOSE),
  subscribe: _.partial(ClientInterface.Emitter.prototype.trigger, CLIENT_EVENTS.SUBSCRIBE),
  unsubscribe: _.partial(ClientInterface.Emitter.prototype.trigger, CLIENT_EVENTS.UNSUBSCRIBE),
  dispatch: _.partial(ClientInterface.Emitter.prototype.trigger, CLIENT_EVENTS.DISPATCH),
});

Object.assign(ClientInterface, {
  inClient: {
    asAdapter: ClientInterface.Listener,
    asLibrary: ClientInterface.Emitter,
  },
  inServer: {
    asAdapter: ClientInterface.Emitter,
    asLibrary: ClientInterface.Listener,
  },
});

// Abstract Server Interface
const ServerInterface = createEventsClass(SERVER_EVENTS);

// Server: Client as library, Server as adapter
Object.assign(ServerInterface.Listener.prototype, {
  onOpen: _.partial(ServerInterface.Listener.prototype.on, SERVER_EVENTS.OPEN),
  offOpen: _.partial(ServerInterface.Listener.prototype.off, SERVER_EVENTS.OPEN),
  onClose: _.partial(ServerInterface.Listener.prototype.on, SERVER_EVENTS.CLOSE),
  offClose: _.partial(ServerInterface.Listener.prototype.off, SERVER_EVENTS.CLOSE),
  onClose: _.partial(ServerInterface.Listener.prototype.on, SERVER_EVENTS.CLOSE),
});

// Server: Client as adapter, Server as library
Object.assign(ServerInterface.Emitter.prototype, {
  open: _.partial(ServerInterface.Emitter.prototype.trigger, SERVER_EVENTS.OPEN),
  close: _.partial(Server.Emitter.prototype.trigger, SERVER_EVENTS.CLOSE),
});

Object.assign(ServerInterface, {
  inClient: {
    asAdapter: ServerInterface.Emitter,
    asLibrary: ServerInterface.Listener,
  },
  inServer: {
    asAdapter: ServerInterface.Listener,
    asLibrary: ServerInterface.Emitter,
  }
});

module.exports = {
  StoreInterface,
  ActionInterface,
  ClientInterface,
  ServerInterface,
};

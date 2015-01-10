import Remutable from 'remutable';
import through from 'through2';
import { EventEmitter } from 'events';

import Client from './Client';
import Server from './Server';

// Client -> ClientAdapter -> Link -> Server
// Server -> Link -> ClientAdapter -> Client

const CONNECTION = 'c'; // connection event name

let _ServerAdapter;

const ClientAdapterDuplex = through.ctor({ objectMode: true, allowHalfOpen: false },
  function receiveFromClient(clientEvent, enc, done) { // receive from Client
    try {
      if(__DEV__) {
        clientEvent.should.be.an.instanceOf(Client.Event);
      }
    }
    catch(err) {
      return done(err);
    }
    this._sendToLink(clientEvent);
    return done(null);
  }
);

class ClientAdapter extends ClientAdapterDuplex {
  constructor(state) {
    if(__DEV__) {
      state.should.be.an.Object;
      state.should.have.property('buffer').which.is.an.Object;
      state.should.have.property('server').which.is.an.instanceOf(_ServerAdapter);
    }
    super(); // will be piped to and from the client
    _.bindAll(this);
    this._buffer = state.buffer;
    this.link = through.obj((serverEvent, enc, done) => { // receive from server
      try {
        if(__DEV__) {
          serverEvent.should.be.an.instanceOf(Server.Event);
        }
      }
      catch(err) {
        return done(err);
      }
      this._sendToClient(serverEvent);
      return done(null);
    }); // will be pipe to and from serverq
    state.server.connect(this.link); // immediatly connect
  }

  fetch(path, hash = null) { // ignore hash
    return Promise.try(() => {
      if(__DEV__) {
        path.should.be.a.String;
        (_.isNull(hash) || _.isString(hash)).should.be.true;
        this._buffer.should.have.property(path);
      }
      return this._buffer[path];
    });
  }

  _sendToClient(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this.push(ev);
  }

  _sendToLink(ev) {
    if(__DEV__) {
      ev.should.an.instanceOf(Client.Event);
    }
    this.link.push(ev);
  }
}

class ServerAdapter extends Server.Adapter {
  constructor(state) {
    if(__DEV__) {
      state.should.be.an.Object;
      state.should.have.property('buffer');
      state.should.have.property('server');
      (state.buffer === null).should.be.ok;
      (state.server === null).should.be.ok;
    }
    super();
    _.bindAll(this);
    state.buffer = this._buffer = {};
    state.server = this;
    this._events = new EventEmitter();
  }

  publish(path, consumer) {
    if(__DEV__) {
      path.should.be.a.String;
      consumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    this._buffer[path] = consumer;
  }

  connect(link) {
    this._events.emit(CONNECTION, link);
  }

  onConnection(accept, lifespan) {
    if(__DEV__) {
      accept.should.be.a.Function;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    this._events.addListener(CONNECTION, accept, lifespan);
  }
}

_ServerAdapter = ServerAdapter;

export default {
  Client: ClientAdapter,
  Server: ServerAdapter,
};

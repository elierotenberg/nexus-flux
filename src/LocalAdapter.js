const Client = require('./Client');
const Server = require('./Server');
const Remutable = require('remutable');
const { EventEmitter } = require('./EventEmitter');

class ClientAdapter extends Client.Adapter {
  constructor(buffer) {
    if(__DEV__) {
      buffer.should.be.an.Object;
    }
    super();
    _.bindAll(this);
  }

  fetch(path, hash) { // ignore hash
    return Promise.resolve(buffer[path]);
  }
}

const CONNECTION = 'c';

class ServerAdapter extends Server.Adapter {
  constructor(buffer) {
    if(__DEV__) {
      buffer.should.be.an.Object;
    }
    super();
    _.bindAll(this);
  }

  publish(path, consumer) {
    if(__DEV__) {
      path.should.be.a.String;
      consumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    buffer[path] = consumer;
  }

  onConnection(accept, lifespan) {
    // no-op.
  }
}

module.exports = {
  Client: ClientAdapter,
  Server: ServerAdapter,
};

const Client = require('./Client');
const Server = require('./Server');
const Remutable = require('remutable');

// Client -> ClientAdapter -> Link -> Server
// Server -> Link -> ClientAdapter -> Client
//
class Bridge {
  constructor() {
    this._buffer = {};
  }
}

const ClientAdapterDuplex = through.ctor({ objectMode: true, allowHalfOpen: false },
  function receive(ev, enc, done) { // Client (them) -> Client.Adapter (us)
    if(__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    done(ev); // Client.Adapter(us) -> Link (them)
  },
  function flush(done) {
    done(null);
  }
);

class ClientAdapter extends ClientAdapterDuplex {
  constructor(buffer) {
    if(__DEV__) {
      buffer.should.be.an.Object;
    }
    super();
    _.bindAll(this);
    this._buffer = buffer;
  }

  fetch(path, hash = null) { // ignore hash
    return Promise.try(() => {
      if(__DEV__) {
        path.should.be.a.String;
        (_.isNull(hash) || _.isString(hash)).should.be.true;
        this._buffer.should.have.property('hash');
      }
      return this._buffer[path];
    });
  }
}

const LinkDuplex = through.ctor({ objectMode: true, allowHalfOpen: false },
  function receive(ev, enc, done) { // Client.Adapter (them) -> Link (us)
    try {
      if(__DEV__) {
        ev.should.be.an.instanceOf(Client.Event);
      }

    }
  }
);

class ServerAdapter {
  constructor(buffer) {
    if(__DEV__) {
      buffer.should.be.an.Object;
    }
    super();
    _.bindAll(this);
    this._buffer = buffer;
  }

  publish(path, consumer) {
    if(__DEV__) {
      path.should.be.a.String;
      consumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    this._buffer[path] = consumer;
  }

  onConnection(accept, lifespan) {
    if(__DEV__) {
      accept.should.be.a.Function;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    // no-op.
  }
}

module.exports = {
  Client: ClientAdapter,
  Server: ServerAdapter,
};

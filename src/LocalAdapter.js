import Remutable from 'remutable';
import Client from './Client';
import Server from './Server';

let _LocalServer;

class LocalClient extends Client {
  constructor(shared) {
    if(__DEV__) {
      shared.should.be.an.Object;
      shared.should.have.property('server').which.is.an.instanceOf(LocalServer);
      shared.should.have.property('buffer').which.is.an.Object;
    }
    this._shared = shared;
    super();
    this._link = new LocalLink(this);
    shared.server.acceptLink(this._link);
    this.lifespan.onRelease(() => {
      this._link.lifespan.release());
      this._link = null;
    });
  }

  sendToServer(ev) {
    this._link.receiveFromClient(ev);
  }

  fetch(path, hash = null) {
    return Promise.try(() => {
      this._shared.buffer.should.have.property(path);
      return this._buffer[path];
    });
  }
}

class LocalLink extends Server.Link {
  constructor(client) {
    if(__DEV__) {
      client.should.be.an.instanceOf(LocalClient);
    }
    super();
    this._client = client;
    this.lifespan.onRelease(() => {
      client.lifespan.release();
      this._client = null;
    });
  }

  sendToClient(ev) {
    this._client.receiveFromServer(ev);
  }
}

class LocalServer extends Server {
  constructor(shared) {
    if(__DEV__) {
      shared.should.be.an.Object;
      shared.should.not.have.property('server');
      shared.should.have.property('buffer').which.is.an.Object;
    }
    super();
    this._shared = shared;
    this._shared.server = this;
    this.lifespan.onRelease(() => {
      delete shared.server;
    });
  }

  publish(path, remutableConsumer) {
    if(__DEV__) {
      path.should.be.a.String;
      remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    this._shared.buffer[path] = remutableConsumer;
  }
}

_LocalServer = LocalServer;

export default {
  Client: LocalClient,
  Server: LocalServer,
};

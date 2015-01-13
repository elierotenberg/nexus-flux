import Remutable from 'remutable';
import Client from './Client';
import Server from './Server';

let _LocalServer;

class LocalClient extends Client {
  constructor(server) {
    if(__DEV__) {
      server.should.be.an.instanceOf(_LocalServer);
    }
    super();
    this._server = server;
    this._link = new LocalLink(this);
    this._server.acceptLink(this._link);
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
      this._server.public.should.have.property(path);
      return this._server.public[path];
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
  constructor() {
    if(__DEV__) {
    }
    super();
    this.public = {};
    this.lifespan.onRelease(() => this.public = null);
  }

  publish(path, remutableConsumer) {
    if(__DEV__) {
      path.should.be.a.String;
      remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    this.public[path] = remutableConsumer;
  }
}

_LocalServer = LocalServer;

export default {
  Client: LocalClient,
  Server: LocalServer,
};

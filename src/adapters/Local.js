import { Client, Server } from '../';
const { Link } = Server;

let _LocalServer;
let _LocalLink;

class LocalClient extends Client {
  constructor(server) {
    if(__DEV__) {
      server.should.be.an.instanceOf(_LocalServer);
    }
    super();
    this._server = server;
    this._link = new _LocalLink(this);
    this._server.acceptLink(this._link);
    this.lifespan.onRelease(() => {
      this._link.lifespan.release();
      this._link = null;
    });
  }

  sendToServer(ev) {
    this._link.receiveFromClient(ev);
  }

  fetch(path) { // just ignore hash
    return Promise.try(() => { // fail if there is not such published path
      this._server.stores.should.have.property(path);
      return this._server.stores[path];
    });
  }
}

class LocalLink extends Link {
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

_LocalLink = LocalLink;

class LocalServer extends Server {
  constructor(stores = {}) {
    if(__DEV__) {
      stores.should.be.an.Object;
    }
    super();
    this.stores = stores;
    this.lifespan.onRelease(() => this.stores = null);
  }
}

_LocalServer = LocalServer;

export default {
  Client: LocalClient,
  Server: LocalServer,
};

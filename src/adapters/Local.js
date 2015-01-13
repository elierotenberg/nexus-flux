import Remutable from 'remutable';
import { Client, Server } from '../';
const { Link } = Server;

let _LocalServer, _LocalLink;

class LocalClient extends Client {
  constructor(server, clientID) {
    if(__DEV__) {
      server.should.be.an.instanceOf(_LocalServer);
    }
    this._server = server;
    this._link = new _LocalLink(this);
    this._server.acceptLink(this._link);
    super(clientID);
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
      this._server.public.should.have.property(path);
      return this._server.public[path];
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
  constructor() {
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
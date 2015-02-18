import Remutable from 'remutable';
import Lifespan from 'lifespan';
import { EventEmitter } from 'nexus-events';

import Client from './Client.Event'; // we just need this reference for typechecks
import { Event } from './Server.Event';

let _Server;

/**
 * @abstract
 */
class Link {
  constructor() {
    if(__DEV__) {
      this.constructor.should.not.be.exactly(Link); // ensure abstracts
      this.sendToClient.should.not.be.exactly(Link.prototype.sendToClient); // ensure virtual
    }
    this.lifespan = new Lifespan();
    this.receiveFromClient = null; // will be set by the server; should be called when received client events, to forward them to the server
    this.lifespan.onRelease(() => {
      this.receiveFromClient = null;
    });
  }

  /**
   * @virtual
   */
  sendToClient(ev) { // should forward the event to the associated client
    if(__DEV__) {
      ev.should.be.an.instanceOf(_Server.Event);
    }
    throw new TypeError('Virtual method invocation');
  }

  acceptFromServer(receiveFromClient) { // will be called by the server
    if(__DEV__) {
      receiveFromClient.should.be.a.Function;
    }
    this.receiveFromClient = receiveFromClient;
  }

  receiveFromServer(ev) { // will be called by server
    if(__DEV__) {
      ev.should.be.an.instanceOf(_Server.Event);
    }
    this.sendToClient(ev);
  }
}

class Server extends EventEmitter {
  constructor() {
    super();
    this.lifespan = new Lifespan();
    this._links = {};
    this._subscriptions = {};
    this.lifespan.onRelease(() => {
      _.each(this._links, ({ link, subscriptions }, linkID) => {
        _.each(subscriptions, (path) => this.unsubscribe(linkID, path));
        link.lifespan.release();
      });
      this._links = null;
      this._subscriptions = null;
    });
  }

  dispatchAction(path, params) {
    return Promise.try(() => {
      if(__DEV__) {
        path.should.be.a.String;
        params.should.be.an.Object;
      }
      this.emit('action', { path, params });
    });
  }

  dispatchUpdate(path, patch) {
    if(__DEV__) {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(Remutable.Patch);
    }
    if(this._subscriptions[path] !== void 0) {
      const ev = new Server.Event.Update({ path, patch });
      _.each(this._subscriptions[path], (link) => {
        link.receiveFromServer(ev);
      });
    }
    return this;
  }

  subscribe(linkID, path) {
    if(__DEV__) {
      linkID.should.be.a.String;
      path.should.be.a.String;
      this._links.should.have.property(linkID);
    }
    if(this._subscriptions[path] === void 0) {
      this._subscriptions[path] = {};
    }
    this._subscriptions[path][linkID] = this._links[linkID].link;
    if(this._links[linkID].subscriptions[path] === void 0) {
      this._links[linkID].subscriptions[path] = path;
    }
    return this;
  }

  unsubscribe(linkID, path) {
    if(__DEV__) {
      linkID.should.be.a.String;
      path.should.be.a.String;
      this._links.should.have.property(linkID);
      this._links[linkID].subscriptions.should.have.property(path);
      this._subscriptions.should.have.property(path);
      this._subscriptions[path].should.have.property(linkID);
    }
    delete this._links[linkID].subscriptions[path];
    delete this._subscriptions[path][linkID];
    if(_.size(this._subscriptions[path]) === 0) {
      delete this._subscriptions[path];
    }
  }

  acceptLink(link) {
    if(__DEV__) {
      link.should.be.an.instanceOf(Link);
    }

    const linkID = _.uniqueId();
    this._links[linkID] = {
      link,
      subscriptions: {},
    };
    link.acceptFromServer((ev) => this.receiveFromLink(linkID, ev));
    link.lifespan.onRelease(() => {
      _.each(this._links[linkID].subscriptions, (path) => this.unsubscribe(linkID, path));
      delete this._links[linkID];
    });
  }

  receiveFromLink(linkID, ev) {
    if(__DEV__) {
      linkID.should.be.a.String;
      this._links.should.have.property(linkID);
      ev.should.be.an.instanceOf(Client.Event);
    }
    if(ev instanceof Client.Event.Subscribe) {
      return this.subscribe(linkID, ev.path);
    }
    if(ev instanceof Client.Event.Unsubscribe) {
      return this.unsubscribe(linkID, ev.path);
    }
    if(ev instanceof Client.Event.Action) {
      return this.dispatchAction(ev.path, ev.params);
    }
    if(__DEV__) {
      throw new TypeError(`Unknown Client.Event: ${ev}`);
    }
  }
}

_Server = Server;

Object.assign(Server, { Event, Link });

export default Server;

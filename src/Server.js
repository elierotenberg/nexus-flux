import Remutable from 'remutable';
import Lifespan from 'lifespan';

import Store from './Store';
import Action from './Action';
import Client from './Client.Event'; // we just need this reference for typechecks
import { Event } from './Server.Event';

/**
 * @abstract
 */
class Link {
  constructor() {
    if(__DEV__) {
      this.constructor.should.not.be.exactly(Link); // ensure abstracts
      this.sendToClientLink.should.not.be.exactly(Link.prototype.sendToClientLink); // ensure virtual
    }
    this.lifespan = new Lifespan();
    _.bindAll(this);
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
      ev.should.be.an.instanceOf(Server.Event);
    }
    throw new Error(`Server.LinkLink should be extended and sendToClientLink should be implemented.`);
  }

  acceptFromServer(receiveFromClient) { // will be called by the server
    if(__DEV__) {
      server.should.be.an.instanceOf(Server);
    }
    this.receiveFromClient = receiveFromClient;
  }

  receiveFromServer(ev) { // will be called by server
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this.sendToClient(ev);
  }
}

/**
 * @abstract
 */
class Server {
  constructor() {
    if(__DEV__) {
      this.constructor.should.not.be.exactly(Server); // ensure abstracts
      this.publish.should.not.be.exactly(Server.prototype.publish); // ensure virtual
    }
    this.lifespan = new Lifespan();
    _.bindAll(this);
    this._stores = {};
    this._actions = {};
    this._links = {};
  }

  /**
   * @virtual
   */
  publish(path, remutableConsumer) {
    if(__DEV__) {
      path.should.be.a.String;
      remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    throw new TypeError('Virtual method invocation');
  }

  acceptLink(link) {
    if(__DEV__) {
      link.should.be.an.instanceOf(Link);
    }

    const linkID = _.uniqueId();
    this._links[linkID] = {
      subscriptions: {},
      clientID: null,
    };
    link.acceptFromServer((ev) => this.receiveFromLink(linkID, ev));
    link.lifespan.onRelease(() => {
      delete this._links[linkID];
    });
  }

  receiveFromLink(linkID, ev) {
    if(__DEV__) {
      linkID.should.be.a.String;
      this._links.should.have.property(linkID);
      ev.should.be.an.instanceOf(Client.Event);
    }
    if(ev instanceof Client.Event.Open) {
      return this._links[linkID].clientID = ev.clientID;
    }
    if(ev instanceof Client.Event.Close) {
      return this._links[linkID].clientID = null;
    }
    if(ev instanceof Client.Event.Subscribe) {
      return this._links[linkID].subscriptions[ev.path] = null;
    }
    if(ev instanceof Client.Event.Unsubscribe) {
      if(this._links[linkID].subscriptions[ev.path] !== void 0) {
        delete this._links[linkID].subscriptions[ev.path];
        return;
      }
      return;
    }
    if(ev instanceof Client.Event.Dispatch) {
      if(this._links[linkID].clientID !== null && this._actions[ev.path] !== void 0) {
        return this._actions[ev.path].producer.dispatch(ev.params, this._links[linkID].clientID);
      }
      return;
    }
    if(__DEV__) {
      throw new TypeError(`Unknown Client.Event: ${ev}`);
    }
  }

  sendToLinks(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    if(ev instanceof Server.Event.Update || ev instanceof Server.Event.Delete) {
      _.each(this._links, ({ link, subscriptions }) => {
        if(subscriptions[ev.path] !== void 0) {
          link.receiveFromServer(ev);
        }
      });
    }
    if(__DEV__) {
      throw new TypeError(`Unknown Server.Event type: ${ev}`);
    }
  }

  Store(path, lifespan) {
    if(__DEV__) {
      path.should.be.a.String;
    }

    const { engine } = this._stores[path] || (() => {
      const engine = new Store.Engine();
      const consumer = engine.createConsumer()
      .onUpdate((consumer, patch) => {
        this._publish(path, consumer);
        this.push(new Server.Event.Update({ path, patch }));
      })
      .onDelete(() => this.push(new Server.Event.Delete({ path })));
      // immediatly publish the (empty) store
      this._publish(path, engine.remutableConsumer);
      return this._stores[path] = { engine, consumer };
    })();
    const producer = engine.createProducer();
    producer.lifespan.onRelease(() => {
      if(engine.producers === 0) {
        this._stores[path].consumer.release();
        engine.lifespan.release();
        delete this._stores[path];
      }
    });
    lifespan.onRelease(producer.lifespan.release);
    return producer;
  }

  Action(path, lifespan) {
    if(__DEV__) {
      path.should.be.a.String;
    }

    const { engine } = this._actions[path] || (() => {
      const engine = new Action.Engine();
      const producer = engine.createProducer();
      return this._actions[path] = {
        engine,
        producer,
      };
    })();
    const consumer = engine.createConsumer();
    consumer.lifespan.onRelease(() => {
      if(engine.consumers === 0) {
        this._actions[path].producer.release();
        engine.lifespan.release();
        delete this._actions[path];
      }
    });
    lifespan.onRelease(consumer.lifespan.release);
    return consumer;
  }
}

Server.Event = Event;
Server.Link = Link;

export default Server;

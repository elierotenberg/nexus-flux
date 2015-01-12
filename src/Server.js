import through from 'through2';
import Remutable from 'remutable';

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
      this.sendToClientLink.should.not.be.exactly(Link.prototype.sendToClientLink);
      this.receiveFromClientLink.should.not.be.exactly(Link.prototype.receiveFromClientLink);
    }
    this.lifespan = new Promise((resolve) => this.release = resolve);
    _.bindAll(this);
    this._server = null;
    this._clientID = null;
    this.lifespan.then(() => {
      this._server = null;
      this._clientID = null;
    });
  }

  /**
   * @virtual
   */
  sendToClientLink(ev) { // should forward the event to an associated client link
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    throw new Error(`Server.LinkLink should be extended and sendToClientLink should be implemented.`);
  }

  attachServer(server) { // will be called by the server
    if(__DEV__) {
      server.should.be.an.instanceOf(Server);
      (this._server === null).should.be.an.instanceOf(Server);
    }
    this._server = server;
  }

  receiveFromServer(ev) { // will be called by server
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this.sendToClientLink(ev);
  }

  sendToServer(ev) { // will be called by the implementation, in response to receiving an event from client link
    if(__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
      (this._server !== null).should.be.true;
    }
    if(ev instanceof Client.Event.Open) {
      this._clientID = ev.clientID;
    }
    if(ev instanceOf Client.Event.Close) {
      this._clientID = null;
    }
    this._server.receiveFromLink(this._clientID, ev);
  }
}

class Server {
  constructor() {
    if(__DEV__) {
      this.publish.should.not.be.exactly(Server.prototype.fetch);
    }
    this.lifespan = new Promise((resolve) => this.release = resolve);
    _.bindAll(this);
    this._stores = {};
    this._actions = {};
    this.lifespan = new Promise((resolve) => this.release = resolve);
    if(adapter.onConnection && _.isFunction(adapter.onConnection)) {
      adapter.onConnection(this.accept, this.lifespan);
    }
  }

  accept(link) {
    if(__DEV__) {
      link.should.have.property('pipe').which.is.a.Function;
    }
    const subscriptions = {};
    let clientID = null;

    link.pipe(through.obj((ev, enc, done) => { // filter & pipe client events to the server
      if(__DEV__) {
        ev.should.be.an.instanceOf(Client.Event);
      }

      if(ev instanceof Client.Event.Open) {
        clientID = ev.clientID;
        return done(null, { clientID, ev });
      }
      if(ev instanceof Client.Event.Close) {
        clientID = null;
        return done(null, { clientID, ev });
      }
      if(ev instanceof Client.Event.Subscribe) {
        subscriptions[ev.path] = true;
        return done(null);
      }
      if(ev instanceof Client.Event.Unsubscribe) {
        if(subscriptions[ev.path]) {
          delete subscriptions[ev.path];
        }
        return done(null);
      }
      if(ev instanceof Client.Event.Dispatch) {
        if(clientID !== null) {
          return done(null, { clientID, ev });
        }
        return done(null);
      }
      return done(new TypeError(`Unknown Client.Event: ${ev}`));
    }))
    .pipe(this);

    this.pipe(through.obj((ev, enc, done) => { // filter & pipe server events to the client
      if(__DEV__) {
        ev.should.be.an.instanceOf(Server.Event);
      }

      if(ev instanceof Server.Event.Update) {
        if(subscriptions[ev.path]) {
          return done(null, ev);
        }
        return done(null);
      }
      if(ev instanceof Server.Event.Delete) {
        if(subscriptions[ev.path]) {
          return done(null, ev);
        }
        return done(null);
      }
      return done(new TypeError(`Unknown Server.Event: ${ev}`));
    }))
    .pipe(link);

    return link;
  }

  _receive({ clientID, ev }) {
    if(__DEV__) {
      clientID.should.be.a.String;
      ev.should.be.an.instanceOf(Client.Event);
    }
    if(ev instanceof Client.Event.Dispatch) {
      const { path, params } = ev;
      if(__DEV__) {
        path.should.be.a.String;
        (params === null || _.isObject(params)).should.be.true;
      }
      if(this._actions[path] !== void 0) {
        return this._actions[path].producer.dispatch({ clientID, params });
      }
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
    producer.lifespan.then(() => {
      if(engine.producers === 0) {
        engine.release();
        delete this._stores[path];
      }
    });
    lifespan.then(producer.release);
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
    consumer.lifespan.then(() => {
      if(engine.consumers === 0) {
        engine.release();
        delete this._actions[path];
      }
    });
    lifespan.then(consumer.release);
    return consumer;
  }
}

class Link {
  constructor() {
    if(__DEV__) {
      this.should.have.property('publish').which.is.a.Function.and.is.not.exactly(Link.prototype.publish);
      this.should.have.property('onConnection').which.is.a.Function.and.is.not.exactly(Link.prototype.onConnection);
    }
  }

  publish(path, consumer) {
    if(__DEV__) {
      path.should.be.an.instanceOf(path);
      consumer.should.be.an.instanceof(Remutable.Consumer);
    }
    throw new TypeError('Server.Link should implement publish(path: String, remutable: Remutable): void 0');
  }

  onConnection(accept, lifespan) {
    if(__DEV__) {
      accept.should.be.a.Function;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    throw new TypeError('Server.Link should implement onConnection(fn: Function(client: Duplex): void 0, lifespan: Promise): void 0');
  }
}

Server.Event = Event;
Server.Link = Link;

export default Server;

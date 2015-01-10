import through from 'through2';
import Remutable from 'remutable';

import Store from './Store';
import Action from './Action';
import Client from './Client.Event'; // we just need this reference for typechecks
import { Event } from './Server.Event';

const ServerDuplex = through.ctor({ objectMode: true, allowHalfOpen: false},
  function receiveFromLink({ clientID, ev }, enc, done) {
    try {
      if(__DEV__) {
        clientID.should.be.a.String;
        ev.should.be.an.instanceOf(Client.Event);
      }
    }
    catch(err) {
      return done(err);
    }
    this._receive({ clientID, ev });
    return done(null);
  },
  function flush(done) {
    this.release();
    done(null);
  }
);

class Server extends ServerDuplex {
  constructor(adapter) {
    if(__DEV__) {
      adapter.should.be.an.instanceOf(Server.Adapter);
      this.should.have.property('pipe').which.is.a.Function;
    }
    super();
    _.bindAll(this);
    this._stores = {};
    this._actions = {};
    this._publish = adapter.publish;
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
      return this._actions[path] = {
        engine,
        producer: engine.createProducer(),
      };
    });
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

class Adapter {
  constructor() {
    if(__DEV__) {
      this.should.have.property('publish').which.is.a.Function.and.is.not.exactly(Adapter.prototype.publish);
      this.should.have.property('onConnection').which.is.a.Function.and.is.not.exactly(Adapter.prototype.onConnection);
    }
  }

  publish(path, consumer) {
    if(__DEV__) {
      path.should.be.an.instanceOf(path);
      consumer.should.be.an.instanceof(Remutable.Consumer);
    }
    throw new TypeError('Server.Adapter should implement publish(path: String, remutable: Remutable): void 0');
  }

  onConnection(accept, lifespan) {
    if(__DEV__) {
      accept.should.be.a.Function;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    throw new TypeError('Server.Adapter should implement onConnection(fn: Function(client: Duplex): void 0, lifespan: Promise): void 0');
  }
}

Server.Event = Event;
Server.Adapter = Adapter;

export default Server;

const { Duplex } = require('stream');
const through = require('through2');
const asap = require('asap');

const Client = require('./Client');

const INT_MAX = 9007199254740992;

class Server extends Duplex {
  constructor() {
    this._stores = {};
    this._actions = {};
    this._publish = null;
    this.on('data', this._receive);

    if(__DEV__) {
      asap(() => {
        try {
          this._publish.should.be.a.Function;
        }
        catch(err) {
          console.warn(`Server#use(publish) should be called immediatly after instanciation.`);
        }
      });
    }
  }

  use(publish) {
    if(__DEV__) {
      publish.should.be.a.Function;
    }
    this._publish = publish;
    return this;
  }

  createLink() {
    const link = new Duplex();
    const subscriptions = {};
    const clientID = null;

    link.pipe(through.obj(function(ev, enc, done) {
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

    this.pipe(through.obj(function(ev)) {
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
    })
    .pipe(link);

    return link;
  }

  _send(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this.write(ev);
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
      return this._stores[path] = {
        engine,
        consumer: engine.createConsumer()
        .onUpdate((consumer, patch) => {
          this._publish(path, consumer);
          this._send(new Server.Event.Update({ path, patch }));
        })
        .onDelete(() => this._send(new Server.Event.Delete({ path }))),
      };
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

class Event {
  constructor() {
    this._s = null;
  }

  get t() {
    return null;
  }

  get p() {
    return {};
  }

  stringify() {
    if(this._s === null) {
      this._s = JSON.stringify({ t: this.t, p: this.p });
    }
    return this._s;
  }

  static parse(json) {
    const { t, p } = JSON.parse(json);
    if(__DEV__) {
      Event._shortName.should.have.ownProperty(json);
    }
    return new Event._shortName[t](p);
  }

  static _register(shortName, longName, Ctor) {
    if(__DEV__) {
      shortName.should.be.a.String;
      shortName.length.should.be.exactly(1);
      longName.should.be.a.String;
      Event._shortName.should.not.have.property(shortName);
      Event.should.not.have.property(longName);
      Ctor.should.be.a.Function;
    }
    Event[longName] = Ctor;
    Event._shortName[shortName] = Ctor;
    Ctor.prototype.t = shortName;
  }
}

Event._shortName = {};

class Update extends Event {
  constructor({ path, patch }) {
    if(__DEV__) {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(patch);
    }
  }
}

module.exports = Server;

import asap from 'asap';
import EventEmitter from './EventEmitter';
import Remutable from 'remutable';
const { Patch } = Remutable;

const EVENTS = { UPDATE: 'c', DELETE: 'd' };

let _Engine;

class Producer {
  constructor(engine) {
    if(__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    _.bindAll(this);
    Object.assign(this, {
      engine,
      lifespan: Promise.any([engine.lifespan, new Promise((resolve) => this.release = resolve)]),
    });
    // proxy getters to engine.remutableProducers
    ['head', 'working', 'hash', 'version']
    .forEach((p) => Object.defineProperty(this, p, {
      enumerable: true,
      get: () => engine.remutableProducer[p],
    }));
    // proxy methods to engine.remutableProducers
    ['rollback', 'match']
    .forEach((m) => this[m] = engine.remutableProducer[m]);
    // proxy methods to engine
    ['apply', 'commit', 'delete']
    .forEach((m) => this[m] = engine[m]);
  }

  set() { // set is chainable
    this.engine.remutableProducer.set.apply(this.engine.remutableProducer, arguments);
    return this;
  }
}

class Consumer {
  constructor(engine) {
    if(__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    const { addListener, remutableConsumer, lifespan } = engine;
    Object.assign(this, {
      addListener,
      remutableConsumer,
      lifespan: Promise.any([lifespan, new Promise((resolve) => this.release = resolve)]),
    });
    _.bindAll(this);

    if(__DEV__) {
      this._onUpdateHandlers = 0;
      this._onDeleteHandlers = 0;
      asap(() => { // check that handlers are immediatly set
        try {
          this._onUpdateHandlers.should.be.above(0);
          this._onDeleteHandlers.should.be.above(0);
        }
        catch(err) {
          console.warn('StoreConsumer: both onUpdate and onDelete handlers should be set immediatly.');
        }
      });
    }
  }

  get value() {
    return this.remutableConsumer.head;
  }

  onUpdate(fn) {
    if(__DEV__) {
      fn.should.be.a.Function;
    }
    this.addListener(EVENTS.UPDATE, fn, this.lifespan);
    if(__DEV__) {
      this._onUpdateHandlers = this._onUpdateHandlers + 1;
    }
    return this;
  }

  onDelete(fn) {
    if(__DEV__) {
      fn.should.be.a.Function;
    }
    this.addListener(EVENTS.DELETE, fn, this.lifespan);
    if(__DEV__) {
      this._onDeleteHandlers = this._onDeleteHandlers + 1;
    }
    return this;
  }
}

class Engine extends EventEmitter {
  constructor(init) {
    init = init || {};
    if(__DEV__) {
      init.should.be.an.Object;
      _.each(init, (val, key) => {
        key.should.be.a.String;
      });
    }
    super();
    this.remutable = new Remutable(init);
    this.remutableProducer = this.remutable.createProducer();
    this.remutableConsumer = this.remutable.createConsumer();
    this.lifespan = new Promise((resolve) => this.release = resolve);
    _.bindAll(this);
    this.consumers = 0;
    this.producers = 0;
  }

  createProducer() {
    const producer = new Producer(this);
    this.producers = this.producers + 1;
    producer.lifespan.then(() => {
      this.producers = this.producers - 1;
    });
    this.lifespan.then(() => producer.release());
    return producer;
  }

  createConsumer() {
    const consumer = new Consumer(this);
    this.consumers = this.consumers + 1;
    consumer.lifespan.then(() => {
      this.consumers = this.consumers - 1;
    });
    this.lifespan.then(() => consumer.release());
    return consumer;
  }

  apply(patch) {
    if(__DEV__) {
      patch.should.be.an.instanceOf(Patch);
    }
    this.remutable.apply(patch);
    this.emit(EVENTS.UPDATE, this.remutableConsumer, patch);
  }

  commit() {
    const patch = this.remutable.commit();
    this.emit(EVENTS.UPDATE, this.remutableConsumer, patch);
  }

  delete() {
    this.emit(EVENTS.DELETE);
    this.remutable = null;
    this.remutableProducer = null;
    this.remutableConsumer = null;
  }
}

_Engine = Engine;

export default { Consumer, Producer, Engine };

import asap from 'asap';
import EventEmitter from './EventEmitter';

const EVENTS = { DISPATCH: 'd' };
let _Engine;

class Producer {
  constructor(engine) {
    if(__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    Object.assign(this, {
      _engine: engine,
      lifespan: Promise.any([engine.lifespan, new Promise((resolve) => this.release = resolve)]),
    });
    _.bindAll(this);
  }

  dispatch(params) {
    if(__DEV__) {
      params.should.be.an.Object;
    }
    this._engine.dispatch(params);
    return this;
  }
}

class Consumer {
  constructor(engine) {
    if(__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    Object.assign(this, {
      _engine: engine,
      lifespan: Promise.any([engine.lifespan, new Promise((resolve) => this.release = resolve)]),
    });
    _.bindAll(this);

    if(__DEV__) {
      this._onDispatchHandlers = 0;
      asap(() => { // check that handlers are immediatly set
        try {
          this._onDispatchHandlers.should.be.above(0);
        }
        catch(err) {
          console.warn('StoreConsumer: onDispatch handler should be set immediatly.');
        }
      });
    }
  }

  onDispatch(fn) {
    if(__DEV__) {
      fn.should.be.a.Function;
    }
    this._engine.addListener(EVENTS.DISPATCH, fn, this.lifespan);
    if(__DEV__) {
      this._onDispatchHandlers = this._onDispatchHandlers + 1;
    }
    return this;
  }
}

class Engine extends EventEmitter {
  constructor() {
    super();
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

  dispatch(params) {
    if(__DEV__) {
      params.should.be.an.Object;
    }
    this.emit(EVENTS.DISPATCH, params);
    return this;
  }
}

_Engine = Engine;

export default { Consumer, Producer, Engine };

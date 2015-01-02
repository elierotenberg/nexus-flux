const asap = require('asap');
const EventEmitter = require('./EventEmitter');

const EVENTS = { DISPATCH: 'd' };

class Producer {
  constructor(emit, lifespan) {
    if(__DEV__) {
      emit.should.be.a.Function;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    _.bindAll(this);
    Object.assign(this, {
      emit,
      lifespan: Promise.any([lifespan, new Promise((resolve) => this.release = resolve)]),
    });
  }

  dispatch(params) {
    if(__DEV__) {
      params.should.be.an.Object;
    }
    this.emit(EVENTS.DISPATCH, params);
    return this;
  }
}

class Consumer {
  constructor(addListener, lifespan) {
    if(__DEV__) {
      addListener.should.be.a.Function;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    _.bindAll(this);
    Object.assign(this, {
      addListener,
      lifespan: Promise.any([lifespan, new Promise((resolve) => this.release = resolve)]),
    });

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
    this.addListener(EVENTS.DISPATCH, fn, this.lifespan);
    if(__DEV__) {
      this._onDispatchHandlers = this._onDispatchHandlers + 1;
    }
    return this;
  }
}

class Engine extends EventEmitter {
  constructor() {
    this.lifespan = new Promise((resolve) => this.release = resolve);
    _.bindAll(this);
    this.consumers = 0;
    this.producers = 0;
    this.addListener(EVENTS.UPDATE, this.update, this.lifespan);
    this.addListener(EVENTS.DELETE, this.delete, this.lifespan);
  }

  createProducer() {
    const producer = new Producer(this.emit, this.lifespan);
    this.producers = this.producers + 1;
    producer.lifespan.then(() => {
      this.producers = this.producers - 1;
    });
    this.lifespan.then(() => producer.release());
    return producer;
  }

  createConsumer() {
    const consumer = new Consumer(this.addListener, this.lifespan);
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

module.exports = { Consumer, Producer, Engine };

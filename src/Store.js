const asap = require('asap');
const EventEmitter = require('./EventEmitter');
const Remutable = require('remutable');
const { Patch } = Remutable;

const EVENTS = { CHANGE: 'c', DELETE: 'd' };

class Producer {
  constructor(emit, remutableConsumer, lifespan) {
    if(__DEV__) {
      emit.should.be.a.Function;
      remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
      lifespan.should.have.property('then').which.is.a.Function;
    }
    _.bindAll(this);
    Object.assign(this, {
      emit,
      remutableConsumer,
      lifespan: Promise.any([lifespan, new Promise((resolve) => this.release = resolve)]),
    });
  }

  update(patch) {
    if(__DEV__) {
      patch.should.be.an.instanceOf(Patch);
    }
    this.emit(EVENTS.UPDATE, patch);
    return this;
  }

  delete() {
    this.emit(EVENTS.DELETE);
    return this;
  }
}

class Consumer {
  constructor(addListener, remutableConsumer, lifespan) {
    if(__DEV__) {
      addListener.should.be.a.Function;
      remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
      lifespan.should.have.property('then').which.is.a.Function;
    }
    _.bindAll(this);
    Object.assign(this, {
      addListener,
      remutableConsumer,
      lifespan: Promise.any([lifespan, new Promise((resolve) => this.release = resolve)]),
    });

    if(__DEV__) {
      this._onChangeHandlers = 0;
      this._onDeleteHandlers = 0;
      asap(() => { // check that handlers are immediatly set
        try {
          this._onChangeHandlers.should.be.above(0);
          this._onDeleteHandlers.should.be.above(0);
        }
        catch(err) {
          console.warn('StoreConsumer: both onChange and onDelete handlers should be set immediatly.');
        }
      });
    }
  }

  get value() {
    return this.remutableConsumer.head;
  }

  onChange(fn) {
    if(__DEV__) {
      fn.should.be.a.Function;
    }
    this.addListener(EVENTS.CHANGE, fn, this.lifespan);
    if(__DEV__) {
      this._onChangeHandlers = this._onChangeHandlers + 1;
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
  constructor() {
    this.remutable = new Remutable();
    this.remutableConsumer = this.remutable.createConsumer();
    this.lifespan = new Promise((resolve) => this.release = resolve);
    _.bindAll(this);
    this.consumers = 0;
    this.producers = 0;
    this.addListener(EVENTS.UPDATE, this.update, this.lifespan);
    this.addListener(EVENTS.DELETE, this.delete, this.lifespan);
  }

  createProducer() {
    const producer = new Producer(this.emit, this.remutable.createConsumer(), this.lifespan);
    this.producers = this.producers + 1;
    producer.lifespan.then(() => {
      this.producers = this.producers - 1;
    });
    this.lifespan.then(() => producer.release());
    return producer;
  }

  createConsumer() {
    const consumer = new Consumer(this.addListener, this.remutableConsumer, this.lifespan);
    this.consumers = this.consumers + 1;
    consumer.lifespan.then(() => {
      this.consumers = this.consumers - 1;
    });
    this.lifespan.then(() => consumer.release());
    return consumer;
  }

  update(patch) {
    if(__DEV__) {
      this.remutable.should.be.an.instanceOf(Remutable);
      patch.should.be.an.instanceOf(Patch);
      this.remutable.match(patch).should.be.true;
    }
    this.remutable.apply(patch);
    this.emit(EVENTS.UPDATE, this.remutableConsumer, patch);
    return this;
  }

  delete() {
    if(__DEV__) {
      this.remutable.should.be.an.instanceOf(Remutable);
    }
    this.remutable = null;
    this.remutableConsumer = null;
    this.emit(EVENTS.DELETE);
    return this;
  }
}

module.exports = { Consumer, Producer, Engine };

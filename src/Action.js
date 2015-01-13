import asap from 'asap';
import { EventEmitter } from 'nexus-events';
import Lifespan from 'lifespan';

const EVENTS = { DISPATCH: 'd' };
let _Engine;

class Producer {
  constructor(engine) {
    if(__DEV__) {
      engine.should.be.an.instanceOf(_Engine);
    }
    _.bindAll(this);
    Object.assign(this, {
      _engine: engine,
      lifespan: new Lifespan(),
    });
  }

  dispatch(params, clientID) {
    if(__DEV__) {
      params.should.be.an.Object;
      if(clientID !== void 0) {
        clientID.should.be.a.String;
      }
    }
    this._engine.dispatch(params, clientID);
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
      lifespan: new Lifespan(),
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
    this.lifespan = new Lifespan();
    _.bindAll(this);
    this.consumers = 0;
    this.producers = 0;
    this.lifespan.onRelease(() => {
      if(__DEV__) {
        this.consumers.should.be.exactly(0);
        this.producers.should.be.exactly(0);
      }
      this.consumers = null;
      this.producers = null;
    });
  }

  createProducer() {
    const producer = new Producer(this);
    this.producers = this.producers + 1;
    producer.lifespan.onRelease(() => this.producers = this.producers - 1);
    return producer;
  }

  createConsumer() {
    const consumer = new Consumer(this);
    this.consumers = this.consumers + 1;
    consumer.lifespan.onRelease(() => this.consumers = this.consumers - 1);
    return consumer;
  }

  dispatch(params, clientID) {
    if(__DEV__) {
      params.should.be.an.Object;
      if(clientID !== void 0) {
        clientID.should.be.a.String;
      }
    }
    this.emit(EVENTS.DISPATCH, params, clientID);
    return this;
  }
}

_Engine = Engine;

export default { Consumer, Producer, Engine };

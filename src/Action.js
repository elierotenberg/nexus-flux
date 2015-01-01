const asap = require('asap');
const { EventEmitter } = require('lifespan');
const Remutable = require('remutable');
const { Patch } = Remutable;

class Producer {
  constructor(emit) {
    if(__DEV__) {
      emit.should.be.a.Function;
    }
    _.bindAll(this);
    this.emit = emit;
  }

  dispatch(params) {
    this.emit('dispatch', params);
    return this;
  }
}

class Consumer {
  constructor(on) {
    if(__DEV__) {
      on.should.be.a.Function;
    }
    _.bindAll(this);
    this.on = on;
    if(__DEV__) {
      this._hasOnDispatch = false;
      asap(() => { // check that handlers are immediatly set
        try {
          this._hasOnDispatch.should.be.true;
        }
        catch(err) {
          console.warn('ActionConsumer: onDispatch handler should be set immediatly.');
        }
      });
    }
  }

  onDispatch(fn) {
    if(__DEV__) {
      fn.should.be.a.Function;
    }
    this.on('dispatch', fn);
    if(__DEV__) {
      this._hasOnDispatch = true;
    }
    return this;
  }
}

class Engine {
  constructor() {
    this.remutable = new Remutable();
    _.bindAll(this);
    this.events = _.bindAll(new EventEmitter());
  }

  createProducer() {
    return new Producer(this.events.emit);
  }

  createConsumer(lifespan) {
    if(__DEV__) {
      should(this.remutable).be.an.instanceOf(Remutable);
      lifespan.should.have.property('then').which.is.a.Function;
    }
    return new Consumer(_.bindAll(this.events.within(lifespan)).on);
  }
}

module.exports = { Consumer, Producer, Engine };

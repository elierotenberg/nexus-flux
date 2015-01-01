const asap = require('asap');
const { EventEmitter } = require('lifespan');
const Remutable = require('remutable');
const { Patch } = Remutable;

class Producer {
  constructor(emit, remutableConsumer) {
    if(__DEV__) {
      emit.should.be.a.Function;
      remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    _.bindAll(this);
    this.emit = emit;
    this.remutableConsumer = remutableConsumer;
  }

  update(patch) {
    if(__DEV__) {
      patch.should.be.an.instanceOf(Patch);
    }
    this.emit('update', patch);
    return this;
  }

  delete() {
    this.emit('delete');
    return this;
  }
}

class Consumer {
  constructor(on, remutableConsumer) {
    if(__DEV__) {
      on.should.be.a.Function;
      remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    _.bindAll(this);
    this.on = on;
    this.remutableConsumer = remutableConsumer;

    if(__DEV__) {
      this._hasOnChange = false;
      this._hasOnDelete = false;
      asap(() => { // check that handlers are immediatly set
        try {
          this._hasOnChange.should.be.true;
          this._hasOnDelete.should.be.true;
        }
        catch(err) {
          console.warn('StoreConsumer: both onChange and onDelete handlers should be set immediatly.');
        }
      });
    }
  }

  onChange(fn) {
    if(__DEV__) {
      fn.should.be.a.Function;
    }
    this.on('change', fn);
    if(__DEV__) {
      this._hasOnChange = true;
    }
    return this;
  }

  onDelete(fn) {
    if(__DEV__) {
      fn.should.be.a.Function;
    }
    this.on('delete', fn);
    if(__DEV__) {
      this._hasOnDelete = true;
    }
    return this;
  }
}

class Engine {
  constructor() {
    this.remutable = new Remutable();
    this.consumer = this.remutable.createConsumer();
    _.bindAll(this);
    this.events = _.bindAll(new EventEmitter())
    .on('update', this.update)
    .on('delete', this.delete);
  }

  createProducer() {
    return new Producer(this.events.emit, this.remutable.createConsumer());
  }

  createConsumer(lifespan) {
    if(__DEV__) {
      this.remutable.should.be.an.instanceOf(Remutable);
      lifespan.should.have.property('then').which.is.a.Function;
    }
    return new Consumer(_.bindAll(this.events.within(lifespan)).on, this.consumer);
  }

  update(patch) {
    if(__DEV__) {
      this.remutable.should.be.an.instanceOf(Remutable);
      patch.should.be.an.instanceOf(Patch);
      this.remutable.match(patch).should.be.true;
    }
    this.remutable.apply(patch);
    this.events.emit('change', this.consumer, patch);
  }

  delete() {
    if(__DEV__) {
      this.remutable.should.be.an.instanceOf(Remutable);
    }
    this.remutable = null;
    this.events.emit('delete');
  }
}

module.exports = { Consumer, Producer, Engine };

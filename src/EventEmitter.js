
// My custom implementation of EventEmitter, with fast & easy listener removal for when tons of listeners are set.
class EventEmitter {
  constructor(debug = __DEV__) {
    this._listeners = {};
    this._debug = debug;
    _.bindAll(this);
  }

  addListener(ev, fn, lifespan) {
    if(__DEV__) {
      ev.should.be.a.String;
      fn.should.be.a.Function;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    if(this._listeners[ev] === void 0) {
      this._listeners[ev] = {};
    }
    const ln = _.uniqueId();
    this._listeners[ev][ln] = fn;
    lifespan.then(() => this._removeListener(ev, ln));
    return this;
  }

  _removeListener(ev, ln) {
    if(__DEV__) {
      ev.should.be.a.String;
      ln.should.be.a.String;
      this._listeners.should.have.property(ev);
      this._listeners[ev].should.have.property(ln);
    }
    delete this._listeners[ev][ln];
    if(_.size(this._listeners[ev]) === 0) {
      delete this._listeners[ev];
    }
  }

  emit(ev, ...args) {
    if(__DEV__) {
      ev.should.be.a.String;
    }
    if(this._listeners[ev] !== void 0) {
      _.each(this._listeners[ev], (fn) => fn(...args));
    }
    else if(this._debug) {
      console.warn(`Emitting event ${ev} ${args} without listeners, this may be a bug.`);
    }
  }
}

export default EventEmitter;

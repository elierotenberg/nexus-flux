const __virtual = require('./__virtual');
const Store = require('./Store');
const Action = require('./Action');

class Client {
  constructor(adapter) {
    this._adapter = adapter;
    this._stores = {};
    this._actions = {};
  }

  within(lifespan) {
    return {
      createStore: (path) => this.createStore(lifespan, path),
      createAction: (path) => this.createAction(lifespan, path),
    };
  }

  fetch(path) {
    return this._adapter.fetch(path);
  }

  createStore(lifespan, path) {
    if(this._stores[path] === void 0) {
      this._stores[path] = {
        engine: new Store.Engine(),
        count: 0,
      };
      this._adapter.registerStore(path, this._stores[path].engine.createProducer());
    }
    this._stores[path].count = this._stores[path].count + 1;
    lifespan.then(() => this._uncreateStore(path));
    return this._stores[path].engine.createConsumer(lifespan);
  }

  _uncreateStore(path) {
    if(__DEV__) {
      this._stores.should.have.property(path);
      this._stores[path].count.should.be.above(0);
    }
    this._stores[path].count = this._stores[path].count - 1;
    if(this._stores[path].count === 0) {
      this._adapter.unregisterStore(path);
      delete this._stores[path];
    }
  }

  createAction(lifespan, path) {
    if(this._actions[path] === void 0) {
      let actionResolve;
      const actionLifespan = new Promise((resolve) => actionResolve = resolve);
      this._actions[path] = {
        engine: new Action.Engine(),
        count: 0,
        resolve: actionResolve,
      };
      this._adapter.registerAction(path, this._actions[path].engine.createConsumer(actionLifespan));
    }
    this._actions[path].count = this._actions[path].count + 1;
    lifespan.then(() => this._uncreateAction(path));
    return this._actions[path].engine.createProducer();
  }

  _uncreateAction(path) {
    if(__DEV__) {
      this._actions.should.have.property(path);
      this._actions[path].count.should.be.above(0);
    }
    this._actions[path].count = this._actions[path].count - 1;
    if(this._actions[path].count === 0) {
      this._adapter.unregisterAction(path);
      this._actions[path].resolve();
      delete this._actions[path];
    }
  }
}

class ClientAdapter {
  constructor() {
    this._stores = {};
    this._actions = {};
  }

  fetch(path) {
    __virtual();
  }

  subscribeStore(path) {
    __virtual();
  }

  unsubscribeStore(path) {
    __virtual();
  }

  dispatchAction(path, params) {
    __virtual();
  }

  registerStore(path, producer) {
    if(__DEV__) {
      path.should.be.a.String;
      producer.should.be.an.instanceOf(Store.Producer);
      this._stores.should.not.have.property(path);
    }
    this._stores[path] = producer;
    this.subscribeStore(path);
  }

  unregisterStore(path) {
    if(__DEV__) {
      path.should.be.a.String;
      this._stores.should.have.property(path);
    }
    this.unsubscribeStore(path);
    delete this._stores[path];
  }

  registerAction(path, consumer) {
    if(__DEV__) {
      path.should.be.a.String;
      consumer.should.be.an.instanceOf(Action.Consumer);
      this._actions.should.not.have.property(path);
    }
    this._actions[path] = consumer;
    consumer.onDispatch((params) => this.dispatchAction(path, params));
  }

  unregisterAction(path) {
    if(__DEV__) {
      path.should.be.a;String;
      this._actions.should.have.property(path);
    }
    delete this._actions[path];
  }
}

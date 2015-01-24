class Event {
  constructor() {
    if(__DEV__) {
      this.should.have.property('_toJS').which.is.a.Function;
      this.constructor.should.have.property('fromJS').which.is.a.Function;
      this.constructor.should.have.property('t').which.is.a.Function;
    }
    Object.assign(this, {
      _json: null,
      _js: null,
    });
  }

  toJS() {
    if(this._js === null) {
      this._js = {
        t: this.constructor.t(),
        j: this._toJS(),
      };
    }
    return this._js;
  }

  toJSON() {
    if(this._json === null) {
      this._json = JSON.stringify(this.toJS());
    }
    return this._json;
  }

  static fromJSON(json) {
    const { t, j } = JSON.parse(json);
    return Event._[t].fromJS(j);
  }
}

class Open extends Event {
  constructor({ clientID }) {
    if(__DEV__) {
      clientID.should.be.a.String;
    }
    super();
    Object.assign(this, { clientID });
  }

  _toJS() {
    return { c: this.clientID };
  }

  static t() {
    return 'o';
  }

  static fromJS({ c }) {
    return new Open({ clientID: c });
  }
}

class Close extends Event {
  _toJS() {
    return {};
  }

  static t() {
    return 'c';
  }

  static fromJS() {
    return new Close();
  }
}

class Subscribe extends Event {
  constructor({ path }) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    super();
    Object.assign(this, { path });
  }

  _toJS() {
    return { p: this.patch };
  }

  static t() {
    return 's';
  }

  static fromJS({ p }) {
    return new Subscribe({ path: p });
  }
}

class Unsubscribe extends Event {
  constructor({ path }) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    super();
    Object.assign(this, { path });
  }

  _toJS() {
    return { p: this.patch };
  }

  static t() {
    return 'u';
  }

  static fromJS({ p }) {
    return new Unsubscribe({ path: p });
  }
}

class Dispatch extends Event {
  constructor({ path, params }) {
    if(__DEV__) {
      path.should.be.a.String;
      params.should.be.an.Object;
    }
    super();
    Object.assign(this, { path, params });
  }

  _toJS() {
    return { p: this.path, a: this.params };
  }

  static t() {
    return 'd';
  }

  static fromJS({ p, a }) {
    return new Dispatch({ path: p, params: a });
  }
}

Event._ = {};
Event.Open        = Event._[Open.t()]         = Open;
Event.Close       = Event._[Close.t()]        = Close;
Event.Subscribe   = Event._[Subscribe.t()]    = Subscribe;
Event.Unsubscribe = Event._[Unsubscribe.t()]  = Unsubscribe;
Event.Dispatch    = Event._[Dispatch.t()]     = Dispatch;

export default { Event };

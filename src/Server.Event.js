import { Patch } from 'remutable';

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

class Update extends Event {
  constructor({ path, patch }) {
    if(__DEV__) {
      path.should.be.a.String;
      patch.should.be.an.instanceOf(Patch);
    }
    super();
    Object.assign(this, { path, patch });
  }

  _toJS() {
    return {
      p: this.path,
      u: this.patch.toJS(),
    };
  }

  static t() {
    return 'u';
  }

  static fromJS({ p, u }) {
    if(__DEV__) {
      p.should.be.a.String;
      u.should.be.an.Object;
    }
    return new Update({ path: p, patch: Patch.fromJS(u) });
  }
}

class Delete extends Event {
  constructor({ path }) {
    if(__DEV__) {
      path.should.be.a.String;
    }
    super();
    Object.assign(this, { path });
  }

  _toJS() {
    return { p: this.path };
  }

  static t() {
    return 'd';
  }

  static fromJS({ p }) {
    if(__DEV__) {
      p.should.be.a.String;
    }
    return new Delete({ path: p });
  }
}

Event._ = {};
Event.Update = Event._[Update.t()] = Update;
Event.Delete = Event._[Delete.t()] = Delete;

export default { Event };

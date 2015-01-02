const { Duplex } = require('stream');
const asap = require('asap');

const INT_MAX = 9007199254740992;

class Server {
  constructor() {
    this._stores = {};
    this._actions = {};
    this._publish = null;
    this._links = {};
    this._subscribers = {};
    if(__DEV__) {
      asap(() => {
        try {
          this._publish.should.be.a.Function;
        }
        catch(err) {
          console.warn(`Server onPublish should be set immediatly.`);
        }
      });
    }
  }

  onPublish(publish) {
    if(__DEV__) {
      publish.should.be.a.Function;
    }
    this._publish = publish;
    return this;
  }

  within(lifespan) {
    return {
      Store: (path) => this.Store(lifespan, path),
      Action: (path) => this.Action(lifespan, path),
      createLink: () => this.createLink(lifespan),
      // make within chainable
      within(other) => this.within(Promise.any([lifespan, other])),
    };
  }

  createLink(lifespan) {
    const linkID = _.uniqueID(`Link${_.random(1, INT_MAX - 1)}`);
    const link = new Link().on('data', this.receive.bind(this, linkID));
    this._links[linkID] = link;
    lifespan.then(() => this._uncreateLink(linkID));
    return link;
  }

  Store(lifespan, path) {

  }

  Action(lifespan, path) {

  }
}

class Link extends Duplex {
  constructor() {

  }
}

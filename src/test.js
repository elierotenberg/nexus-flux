import Lifespan from 'lifespan';
import Remutable from 'remutable';
import { Client, Server } from './adapters/Local';
import hash from 'sha256';

const stores = {};

const server = new Server(stores);
const client = new Client(server);

server.lifespan.onRelease(() => console.log('server released'));
client.lifespan.onRelease(() => console.log('client released'));

// server main
_.defer(() => {
  // initialize several stores
  const clock = stores['/clock'] = new Remutable({
    date: Date.now(),
  });
  const todoList = stores['/todoList'] = new Remutable({});

  // update clock every 500ms
  server.lifespan.setInterval(() => {
    server.dispatchUpdate('/clock', clock.set('date', Date.now()).commit());
  }, 500);

  const actions = {
    '/addItem': ({ name, description, ownerKey }) => {
      const item = { name, description, ownerHash: hash(ownerKey) };
      if(todoList.get(name) !== void 0) {
        return;
      }
      server.dispatchUpdate('/todoList', todoList.set(name, item).commit());
    },
    '/removeItem': ({ name, ownerKey }) => {
      const item = todoList.get(name);
      if(item === void 0) {
        return;
      }
      const { ownerHash } = item;
      if(hash(ownerKey) !== ownerHash) {
        return;
      }
      server.dispatchUpdate('/todoList', todoList.set(name, void 0).commit());
    },
  };

  server.on('action', ({ path, params }) => {
    if(actions[path] !== void 0) {
      actions[path](params);
    }
  }, server.lifespan);

  // release the server in 10000ms
  server.lifespan.setTimeout(server.lifespan.release, 10000);
});

// client main
_.defer(() => {
  const ownerKey = hash(`${Date.now()}:${_.random()}`);
  // subscribe to a store
  client.getStore('/clock', client.lifespan)
  // every time its updated (including when its first fetched), display the modified value (it is an Immutable.Map)
  .onUpdate(({ head }) => {
    console.log('clock tick', head.get('date'));
  })
  // if its deleted, then do something appropriate
  .onDelete(() => {
    console.log('clock deleted');
  });

  // this store subscribers has a limited lifespan (eg. a React components' own lifespan)
  const todoListLifespan = new Lifespan();
  const todoList = client.getStore('/todoList', todoListLifespan)
  // when its updated, we can access not only the up-to-date head, but also the underlying patch object,
  .onUpdate(({ head }, patch) => {
    // if we want to do something with it (we can just ignore it as above)
    console.log('received todoList patch:', patch);
    console.log('todoList head is now:', head.toJS());
  })
  .onDelete(() => {
    console.log('todoList deleted');
  });
  // dispatch some actions
  client.dispatchAction('/addItem', { name: 'Harder', description: 'Code harder', ownerKey });
  // force resync
  client.forceResync();

  client.dispatchAction('/addItem', { name: 'Better', description: 'Code better', ownerKey });
  client.lifespan
  // add a new item in 1000ms
  .setTimeout(() => client.dispatchAction('/addItem', { name: 'Faster', description: 'Code Faster', ownerKey }), 1000)
  // remove an item in 2000ms
  .setTimeout(() => client.dispatchAction('/removeItem', { name: 'Harder', ownerKey }), 2000)
  // add an item in 3000ms
  .setTimeout(() => client.dispatchAction('/addItem', { name: 'Stronger', description: 'Code stronger', ownerKey }), 3000)
  // remove every item in 4000
  .setTimeout(() => todoList.value.forEach(({ description }, name) => {
    void description;
    client.dispatchAction('/removeItem', { name, ownerKey });
  }), 4000)
  // release the subscriber in 5000ms
  .setTimeout(todoListLifespan.release, 5000)
  // release the client in 6000ms
  .setTimeout(client.lifespan.release, 6000);
});

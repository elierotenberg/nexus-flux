import Lifespan from 'lifespan';
import Remutable from 'remutable';
import { Client, Server } from './adapters/Local';
import hash from 'sha256';

const stores = {};

const server = new Server(stores);
const client = new Client(server);

server.lifespan.onRelease(() => console.log('server released'));
client.lifespan.onRelease(() => console.log('client released'));

_.defer(() => { // server main
  // initialize several stores
  const clock = stores['/clock'] = new Remutable({
    date: Date.now(),
  });
  const todoList = stores['/todoList'] = new Remutable({});

  server.lifespan.setInterval(() => {
    server.dispatchUpdate('/clock', clock.set('date', Date.now()).commit());
  }, 500); // update clock every 500ms

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

  server.lifespan.setTimeout(server.lifespan.release, 10000); // release the server in 10000ms
});

_.defer(() => { // client main
  const ownerKey = hash(`${Date.now()}:${_.random()}`);
  client.getStore('/clock', client.lifespan) // subscribe to a store
  .onUpdate(({ head }) => { // every time its updated (including when its first fetched), display the modified value (it is an Immutable.Map)
    console.log('clock tick', head.get('date'));
  })
  .onDelete(() => { // if its deleted, then do something appropriate
    console.log('clock deleted');
  });

  const todoListLifespan = new Lifespan(); // this store subscribers has a limited lifespan (eg. a React components' own lifespan)
  const todoList = client.getStore('/todoList', todoListLifespan)
  .onUpdate(({ head }, patch) => { // when its updated, we can access not only the up-to-date head, but also the underlying patch object,
    console.log('received todoList patch:', patch); // if we want to do something with it (we can just ignore it as above)
    console.log('todoList head is now:', head.toJS());
  })
  .onDelete(() => {
    console.log('todoList deleted');
  });

  client.dispatchAction('/addItem', { name: 'Harder', description: 'Code harder', ownerKey }); // dispatch some actions
  client.dispatchAction('/addItem', { name: 'Better', description: 'Code better', ownerKey });
  client.lifespan
  .setTimeout(() => client.dispatchAction('/addItem', { name: 'Faster', description: 'Code Faster', ownerKey }), 1000) // add a new item in 1000ms
  .setTimeout(() => client.dispatchAction('/removeItem', { name: 'Harder', ownerKey }), 2000) // remove an item in 2000ms
  .setTimeout(() => client.dispatchAction('/addItem', { name: 'Stronger', description: 'Code stronger', ownerKey }), 3000) // add an item in 3000ms
  .setTimeout(() => todoList.value.forEach(({ description }, name) => { // remove every item in 4000
    client.dispatchAction('/removeItem', { name, ownerKey });
  }), 4000)
  .setTimeout(todoListLifespan.release, 5000) // release the subscriber in 5000ms
  .setTimeout(client.lifespan.release, 6000); // release the client in 6000ms
});

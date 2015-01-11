import { Client, Server, LocalAdapter } from '../';

// shared state
const state = { buffer: null, server: null };

_.defer(function() { // server main
  // this Promise represents the lifespan of the server; it resolves when the server dies.
  let release;
  const lifespan = new Promise((resolve) => release = resolve);
  // insanciate the server, make it publish to the shared state
  const server = new Server(new LocalAdapter.Server(state));
  // create a new store at the '/clock' path
  const clock = server.Store('/clock', lifespan);
  // create a new store at the '/list' path
  const list = server.Store('/list', lifespan);
  // initialize the list store with { length: 0 } and immediatly commit
  list.set('length', 0).commit();
  const i = setInterval(() => { // every 1 sec, perform some updates and commit them immediatly
    clock.set('date', Date.now()).commit(); // commit per store
    list.set(`${list.head.get('length')}`, _.random(0, 10))
    .set('length', list.head.get('length') + 1)
    .commit(); // this commit will be relatively lightweight and its size is not related to the size of the list
  }, 1000);
  // whenever the server dies, clear this loop
  lifespan.then(() => clearInterval(i));

  server.Action('/ping', lifespan)
  .onDispatch((payload) => {
    console.warn('pong', payload);
  });

  setTimeout(release, 11000); // at some point in the future, shutdown the server
});

_.defer(function() { // client main
  // this Promise repesents the lifespan of the client
  let release;
  const lifespan = new Promise((resolve) => release = resolve);
  // instanciate the client, make it fetch from the shared state
  const client = new Client(new LocalAdapter.Client(state));
  const ping = client.Action('/ping', lifespan);
  // subscribe to the store at the '/clock' path
  client.Store('/clock', lifespan)
  .onUpdate(({ head }) => { // whenever it updates, print the new value
    console.warn('new date', head.get('date'));
  })
  .onDelete(() => { // wheneve its deleted, print it
    console.warn('deleted date');
  });

  // subscribe to the store at the '/list' path
  client.Store('/list', lifespan)
  .onUpdate(({ head }, patch) => { // whenever it update, print the new value and the serialized patch object
    console.warn('new list', head, patch.toJSON());
  })
  .onDelete(() => { // whenever its deleted, print it
    console.warn('deleted list');
  });

  const i = setInterval(() => {
    ping.dispatch({ timestamp: Date.now() });
  }, 1200);

  lifespan.then(() => clearInterval(i));

  setTimeout(release, 10000); // at some point in the future, shutdown the client
});

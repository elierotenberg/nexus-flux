import Lifespan from 'lifespan';
import { Client, Server } from '../Local';

const server = new Server();
const client = new Client(server);

server.lifespan.onRelease(() => console.log('server released'));
client.lifespan.onRelease(() => console.log('client released'));

_.defer(() => { // server main
  const clock = server.Store('/clock', server.lifespan); // create a new store, initally empty ({})
  clock.set('date', Date.now()).commit(); // initialize it with a single field, date, and commit it immediatly
  const todoList = server.Store('/todoList', server.lifespan); // create another store, initially empty({})

  server.lifespan.setInterval(() => clock.set('date', Date.now()).commit(), 500); // update clock every 500ms

  server.Action('/addItem', server.lifespan) // register a new action
  .onDispatch(({ name, description }, clientHash) => { // register an Action handler
    if(todoList.get(name) !== void 0) { // ignore if we already know this task
      return;
    }
    console.log(`${clientHash} added task ${name} (${description}).`);
    todoList.set(name, { description, clientHash }).commit(); // add an item to the todolist and commit
  });

  server.Action('/removeItem', server.lifespan) // register a new action
  .onDispatch(({ name }, clientHash) => { // register another action handler
    if(todoList.working.get(name) === void 0) { // if we don't have this action, dismiss
      return;
    }
    if(todoList.working.get(name).clientHash !== clientHash) { // if this client hasn't set this item, dismiss
      return;
    }
    console.log(`removed item ${name}`);
    todoList.unset(name, void 0).commit(); // remove the item and commit
  });

  server.lifespan.setTimeout(server.lifespan.release, 10000); // release the server in 10000ms
});

_.defer(() => { // client main
  const addItem = client.Action('/addItem', client.lifespan).dispatch; // register 2 actions dispachers
  const removeItem = client.Action('/removeItem', client.lifespan).dispatch;

  client.Store('/clock', client.lifespan) // subscribe to a store
  .onUpdate(({ head }) => { // every time its updated (including when its first fetched), display the modified value (it is an Immutable.Map)
    console.log('clock tick', head.get('date'));
  })
  .onDelete(() => { // if its deleted, then do something appropriate
    console.log('clock deleted');
  });

  const todoListLifespan = new Lifespan(); // this store subscribers has a limited lifespan (eg. a React components' own lifespan)
  const todoList = client.Store('/todoList', todoListLifespan)
  .onUpdate(({ head }, patch) => { // when its updated, we can access not only the up-to-date head, but also the underlying patch object,
    console.log('received todoList patch:', patch); // if we want to do something with it (we can just ignore it as above)
    console.log('todoList head is now:', head.toJS());
  })
  .onDelete(() => {
    console.log('todoList deleted');
  });

  addItem({ name: 'Harder', description: 'Code harder' }); // dispatch some actions
  addItem({ name: 'Better', description: 'Code better' });
  client.lifespan
  .setTimeout(() => addItem({ name: 'Faster', description: 'Code Faster' }), 1000) // add a new item in 1000ms
  .setTimeout(() => removeItem({ name: 'Harder' }), 2000) // remove an item in 2000ms
  .setTimeout(() => addItem({ name: 'Stronger', description: 'Code stronger' }), 3000) // add an item in 3000ms
  .setTimeout(() => todoList.value.forEach(({ description }, name) => { // remove every item in 4000
    removeItem({ name });
  }), 4000)
  .setTimeout(todoListLifespan.release, 5000) // release the subscriber in 5000ms
  .setTimeout(client.lifespan.release, 6000); // release the client in 6000ms
});

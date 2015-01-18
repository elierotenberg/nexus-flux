Nexus Flux
==========

Abstract Nexus Flux Diagram
```
    +-> Action.dispatch ---+--> Client.Events ---+--> Action.onDispatch -+
    |    Fire & forget             Stream                 Callback       |
Component logic         Adapter               Adapter               Global logic
    |      Callback                Stream               Fire & forget    |
    +-- Store.onUpdate  <--+--- Server.Events <--+------ Store.update ---+
```


Local Nexus Flux Diagram
```
Component #1 <---+
                 |
Component #2 <---+-- LocalAdapter -> Global logic
                 |
Component #3 <---+

```

Over the wire Nexus Flux Diagram using Websockets (with socket.io fallback)
```
in the browser        socket.io frames     in the server

Component #A1 <---+
                  |
Component #A2 <---+-- SocketIOAdapter -+
                  |      Client A      |
Component #A3 <---+                    |
                                       +-> Global logic
Component #B1 <---+                    |
                  |                    |
Component #B2 <---+-- SocketIOAdapter -+
                  |      Client B
Component #B3 <---+
```

Off-thread Flux using WebWorkers
```
in the main thread   postMessage frames  in the webworker

Component #1 <---+
                 |
Component #2 <---+-- WebWorkerAdapter -> Global logic
                 |
Component #3 <---+
```

#### Principles

Nexus Flux abstracts the concepts of Facebook's Flux architecture to its most general form:
- 'Clients' can subscribe to __Stores__ updates, and dispatch __Actions__ with a payload
- 'Server' handles __Actions__ and update __Stores__.

The Client/Server abstraction is merely an abstraction. The traditionnal, in-browser-memory
Flux implementation, is done purely on the (Internet) Client side. However, this abstraction allows
to conceive Flux more rigorously and more importantly, to implement Flux over the Wire trivially.

This representation of Flux enforces immutable Stores and asynchronous communication. Acknowledging
that Flux communication is asycnhronous upfront avoid the pain of mindlessly wrapping everything in `setImmediate`
on top of a synchronous implementation.

Nexus Flux provides an abstract implementation that takes away all boilerplate calls such as registering and unregistering callbacks, dealing with events directly, etc,
and lets you focus on two things: your components logic and your global logic.

Nexus Flux is built with React, Nexus Uplink and React Nexus in mind, but it is not tied to any of these projects and can be used a standalone library.


#### Use cases

Nexus Flux is designed with the following use cases in mind:

- Implementing Flux over the Wire: dispatch actions from clients and propagate store updates to all connected clients in real time, efficiently.

- Expose an isomorphic environment to an app: initialize a local flux on the server using the `request` object, or in the browser using the `window` object, and abstract it away.

- Defer expensive calculations off the main thread: fetch raw collections from a remote cache, filter & retreat locally without blocking the main UI thread.

#### Client usage example (in a React view)

```js
{
  getInitialState() {
    this.lifespan = new Lifespan();
    return {
      todoList: this.props.flux.Store('/todo-list', this.lifespan).value,
    };
  }

  componentWillMount() {
    this.props.flux.Store('/todo-list', this.lifespan)
    .onUpdate(({ head }) => this.setState({ todoList: head }))
    .onDelete(() => this.setState({ todoList: void 0 }));
    this.removeItem = this.props.flux.Action('/remove-item', this.lifespan).dispatch;
  }

  componentWillUnmount() {
    this.lifespan.release();
  }

  render() {
    return this.state.todoList ? todoList.map((item, name) =>
      <div onClick={() => this.removeItem({ name })}>
        {item.get('description')} (Click to remove)
      </div>
    ) : null;
  }
}
```

#### Server usage example

```js
const todoList = server.Store('/todo-list', myApp.lifespan);
const removeItem = server.Action('/remove-item', myApp.lifespan);

todoList
.set('first', { description: 'My first item' })
.set('second', { description: 'My second item' })
.set('third', { description: 'My third item' })
.commit();

removeItem.onDispatch((clientID, { name }) => {
  todoList.delete(name).commit();
});
```

#### Traditional local flux using [nexus-flux/adapters/Local](https://github.com/elierotenberg/nexus-flux/tree/master/adapters/Local.js)

This implements the orthodox Flux for in-app data propagation.

```js
import { Server, Client } from 'nexus-flux/adapters/Local';
const server = new Server();
const client = new Client(server);
// use the server and client instance like above.
```

#### Flux over the wire using [nexus-flux-socket.io](https://github.com/elierotenberg/nexus-flux-socket.io)

Share global server-side app state across all connected clients.

```js
// Client side: runs in the browser or in a node process
import Client from 'nexus-flux-socket.io/client';
const client = Client('http://localhost:8080'));
```

```js
// Server side: runs in a node process, which may or may not be the same process
import Server from 'nexus-flux-socket.io/server';
const server = new Server(8080);
```

#### In browser, off-thread local flux using [nexus-flux/adapters/Worker](https://github.com/elierotenberg/nexus-flux/tree/master/adapters/Worker.js)

Defer expensive app-state data calculations off the main thread to avoid blocking UI. No black magic, just clever message passing.

```js
// Client side: runs in the main thread
import { Client } from 'nexus-flux/adapters/Worker';
const worker = new Worker('my-web-worker.js');
const client = new Client(worker);
```

```js
// Server side: runs in the webworker
import { Server } from 'nexus-flux/adapters/Worker';
const server = new Server(self);
```

#### Cross-window flux using nexus-flux-xwindow (TBD)

Communicate between windows from the same origin using the flux architecture.

```js
// Client side: runs in the child window
import { Client } from 'nexus-flux/adapters/XWindow';
const client = new Client(window.parent);
```

```js
// Server side: runs in the parent window
import { Server } from 'nexus-flux/adapters/XWindow';
const server = new Server(window);
```

#### Node-to-node TCP flux using nexus-flux-node (TBD)

Communicate between node servers using the flux architecture.

```js
// Client side: runs in a node process
import { Client } from 'nexus-flux/adapters/TCP';
const client = new Client('192.168.0.1', 8080);
```

```js
// Server side: runs in a node process, which may or may not be the same process
import { Server } from 'nexus-flux/adapters/TCP';
const server = new Server(8080);
```

#### Implement your own adapter!

If you think of a communication channel where Flux would be relevant, you can implement your own adapter.

The LocalAdapter and WebworkerAdapter sources should provide helpful guidance for doing so.

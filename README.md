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
Component #2 <---+-- Stream.Duplex Adapter -> Global logic
                 |
Component #3 <---+

```

Over the wire Nexus Flux Diagram using Websockets
```
Component #A1 <---+
                  |
Component #A2 <---+-- Websocket Adapter -+
                  |       Client A       |
Component #A3 <---+                      |
                                         +-> Global logic
Component #B1 <---+                      |
                  |                      |
Component #B2 <---+-- Websocket Adapter -+
                  |       Client B
Component #B3 <---+
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

#### Client usage example (in a React view)

```js
{
  getInitialState() {
    this.lifespan = new Promise((resolve) => this._lifespan = resolve);
    return {
      todoList: this.props.flux.Store('/todo-list', this.lifespan).value,
    };
  }

  componentWillMount() {
    this.props.flux.Store('/todo-list', this.lifespan)
    .onChange((todoList) => this.setState({ todoList }))
    .onDelete(() => this.setState({ todoList: undefined }));
    this.removeItem = this.props.flux.Action('/remove-item', this.lifespan).dispatch;
  }

  componentWillUnmount() {
    this._lifespan();
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
const todoList = server.Store('/todo-list');
const removeItem = server.Action('/remove-item');

todoList
.set('first', { description: 'My first item' })
.set('second', { description: 'My second item' })
.set('third', { description: 'My third item' })
.commit();

removeItem.onDispatch((clientID, { name }) => {
  todoList.delete(name).commit();
});
```

#### Implementation example: local flux using LocalAdapter

This implements the orthodox Flux for in-app data propagation.

You can check the adapter from [its source](https://github.com/elierotenberg/nexus-flux/tree/master/src/LocalAdapter.js), which is trivial.

```js
// init a shared state object; will be used by the LocalAdapter Server/Clients
const state = { buffer: null, server: null };
const server = new Server(new LocalAdapter.Server(state));
const client = new Client(new LocalAdapter.Client(state));
// use the server and client instance like above.
```

#### Implementation example: flux over the wire using nexus-flux-socket.io

Share global server-side app state across all connected clients.

```js
// Client side: runs in the browser or in a node process
const client = new Client(new SocketIOAdapter.Client('http://localhost:8080'));
```

```js
// Server side: runs in a node process, which may or may not be the same process
const server = new Server(new SocketIOAdapter.Server({ port: 8080, maxClients: 50000 });
```

#### Implementation example: off-thread local flux using WebWorkerAdapter

Defer expensive app-state data calculations off the main thread to avoid blocking UI.

You can check the adapter from [its source](https://github.com/elierotenberg/nexus-flux/tree/master/src/WebWorkerAdapter.js). No black magic.

```js
// Client side: runs in the main thread
const client = new Client(new WebworkerAdapter.Client(new Worker('my-web-worker.js')));
```

```js
// Server side: runs in the webworker
const server = new Server(new WebWorkerAdapter.Server());
```

#### Implementation example: cross-window flux using nexus-flux-xwindow

Communicate between windows from the same origin using the flux architecture.

```js
// Client side: runs in the child window
const client = new Client(new XWindowAdapter.Client({ window: window.parent }));
```

```js
// Server side: runs in the parent window
// Restrict access to the opened window
const w = window.open(...);
const server = new Server(new XWindowAdapter.Server({ accept: [w] }));
```

#### Implementation example: node-to-node TCP flux using nexus-flux-node

Communicate between node servers using the flux architecture.

```js
// Client side: runs in a node process
const client = new Client(new NodeAdapter.Client('http://192.168.0.1:8080'));
```

```js
// Server side: runs in a node process, which may or may not be the same process
const server = new Server(new NodeAdapter.Server({ port: 8080 }));
```


#### Implement your own adapter!

If you think of a communication channel where Flux would be relevant, you can implement your own adapter.

The LocalAdapter and WebworkerAdapter sources should provide helpful guidance for doing so.

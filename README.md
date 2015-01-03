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

#### Implementation example: local flux

```js

// server-side store single source of truth is an Object containing Remutable instances
const data = {};

// instanciate a server with a basic publish implementation
const server = new Server().use((path, value) => data[path] = value);
// instanciate a client with a basic fetch implementation
const client = new Client().use((path) => Promise.resolve(data[path].head));

// instanciate a link (representation of a client from the server)
const link = server.Link();

// attach both ends together
client.pipe(link); // client output goes into link input
link.pipe(client); // link output goes into client input

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

React.render(<MyComponent flux={client} />, document.getElementById('app-root'));

// Unpipe everything in 10s
setTimeout(() => {
  client.end();
  link.end();
}, 10000);
```

Nexus Flux
==========


#### Client usage example (in a React view)

```js
{
  getFlux() {
    return this.props.flux.within(this.lifespan);
  }

  componentWillMount() {
    const lifespan = new Promise((resolve) => this._unmount = resolve);
    this.getFlux().createStore('/todo-list')
    .onChange((todoList) => this.setState({ todoList }))
    .onDelete(() => this.setState({ todoList: undefined }));
    this.removeItem = flux.within(lifespan).createAction('/remove-item');
  }

  componentWillUnmount() {
    this._unmount();
  }

  render() {
    return todoList.head.map((item, name) =>
      <div onClick={() => this.removeItem.dispatch({ name })}>
        {item.get('description')} (Click to remove)
      </div>
    );
  }
}
```

#### Server usage example

```js
const todoList = server.createStore('/todo-list');
const removeItem = server.createAction('/remove-item');

todoList
.set('first', { description: 'My first item' })
.set('second', { description: 'My second item' })
.set('third', { description: 'My third item' })
.commit();

removeItem.onDispatch((clientID, { name }) => {
  todoList.delete(name).commit();
});
```

#### Implementation example: local service

```
const data = {};

// provide trivial fetch/publish implementations
function fetch(path) {
  return Promise.resolve(data[path].head);
}

function publish(path, value) {
  data[path] = value;
}

// Simply plug the event streams
const client = new Client(fetch);
const server = new Server(publish);
const link = server.createLink();
client.pipe(link);
link.pipe(client);

React.render(<MyComponent flux={client} />, document.getElementById('app-root'));
```


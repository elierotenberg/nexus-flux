const { Client, Server, LocalAdapter } = require('../');

// shared state
const state = { buffer: null, server: null };

_.defer(function() { // server main
  const server = new Server(new LocalAdapter.Server(state));
  const todoList = server.Store('/todoList');
});

_.defer(function() { // client main
  const client = new Client(new LocalAdapter.Client(state));
  const todoList = client.Store('/todoList');
});

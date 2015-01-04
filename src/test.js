const { Client, Server, LocalAdapter } = require('../');

const buffer = {};
const client = new Client(new LocalAdapter.Client(buffer));
const server = new Server(new LocalAdapter.Server(buffer));
server.accept(client);

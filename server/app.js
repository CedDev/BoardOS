/**
 * Main application file
 */

'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

//var newrelic = require('newrelic');
var express = require('express');
var mongoose = require('mongoose');
mongoose.Promise = Promise;
var config = require('./config/environment');

// Connect to database
mongoose.connect(config.mongo.uri, config.mongo.options);

//Mongoose: default lean to true (always on)
var __setOptions = mongoose.Query.prototype.setOptions;
mongoose.Query.prototype.setOptions = function(options, overwrite) {
  __setOptions.apply(this, arguments);
  if (this.options.lean === null) this.options.lean = true;
  return this;
};

// Populate DB with sample data
if (config.seedDB) {
  require('./config/seed');
}

// Setup server
var app = express();
var server = require('http').createServer(app);
var socketio = require('socket.io')(server, {
  serveClient: (config.env === 'production') ? false : true,
  path: '/socket.io-client'
});
require('./config/socketio')(socketio);
require('./config/express')(app);
require('./routes')(app);

// Start server
server.listen(config.port, config.ip, function() {

});
process.on('uncaughtException', function(exception) {
  // to see your exception details in the console
  // if you are on production, maybe you can send the exception details to your
  // email as well ?
});

// Expose app
exports = module.exports = app;

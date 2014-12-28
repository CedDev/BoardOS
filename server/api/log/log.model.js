'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var LogSchema = new Schema({
  info: String,
  actor: String,
  date:{ type: Date, default: Date.now },
  moment:String
}, { strict: false });

module.exports = mongoose.model('Log', LogSchema);
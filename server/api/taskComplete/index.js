'use strict';

var express = require('express');
var controller = require('./taskComplete.controller');

var router = express.Router();

router.get('/', controller.index);
router.get('/execute', controller.execute);
router.get('/:id', controller.show);
router.get('/executeId/:taskId', controller.executeId);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id', controller.update);
router.delete('/:id', controller.destroy);

module.exports = router;

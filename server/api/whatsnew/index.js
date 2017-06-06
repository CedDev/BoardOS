'use strict';

var express = require('express');
var controller = require('./whatsnew.controller');

var router = express.Router();

router.get('/', controller.index);
router.get('/updateViewer/:id', controller.updateViewer);
router.get('/:id', controller.show);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id', controller.update);
router.delete('/:id', controller.destroy);

module.exports = router;

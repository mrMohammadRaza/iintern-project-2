const express = require('express');
const router = express.Router();
const columnController = require('../controllers/columnController');
const taskController = require('../controllers/taskController');
const { verifyToken, requireColumnAccess } = require('../middleware/auth');

// All column routes require authentication
router.use(verifyToken);

// Update column name or position
router.put('/:id', requireColumnAccess, columnController.updateColumn);

// Delete column (blocks deletion if column contains tasks)
router.delete('/:id', requireColumnAccess, columnController.deleteColumn);

// Create task in this column
router.post('/:id/tasks', requireColumnAccess, taskController.createTask);

module.exports = router;

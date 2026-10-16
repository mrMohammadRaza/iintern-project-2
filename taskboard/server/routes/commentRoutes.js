const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { verifyToken } = require('../middleware/auth');

// All comment routes require authentication
router.use(verifyToken);

// Delete comment (Author only)
router.delete('/:id', commentController.deleteComment);

module.exports = router;

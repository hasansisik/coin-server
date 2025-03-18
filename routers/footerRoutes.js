const express = require('express');
const router = express.Router();
const {
  getFooter,
  updateKvk,
  updateLogin,
  initializeFooter,
  updateInfo,
  updateSocialMenu,
  deleteSocialMenuItem
} = require('../controllers/footerController');

// Initialize footer
router.post('/initialize', initializeFooter);

// Get footer data
router.get('/', getFooter);

// Update sections
router.put('/login', updateLogin);
router.put('/kvk', updateKvk);
router.put('/info', updateInfo);
router.put('/social-menu', updateSocialMenu);
router.delete('/social-menu/:itemId', deleteSocialMenuItem);

module.exports = router;

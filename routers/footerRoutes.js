const express = require('express');
const router = express.Router();
const {
  getFooter,
  updateAboutUs,
  updateCopyright,
  updateCookiePolicy,
  updateKvk,
  addFormSubmission,
  deleteFormSubmission,
  initializeFooter,
  updateSocialMenu,
  deleteSocialMenuItem
} = require('../controllers/footerController');

// Initialize footer
router.post('/initialize', initializeFooter);

// Get footer data
router.get('/', getFooter);

// Update sections
router.put('/about-us', updateAboutUs);
router.put('/copyright', updateCopyright);
router.put('/cookie-policy', updateCookiePolicy);
router.put('/kvk', updateKvk);
router.put('/social-menu', updateSocialMenu);
router.delete('/social-menu/:itemId', deleteSocialMenuItem);

// Form submissions
router.post('/forms', addFormSubmission);
router.delete('/forms/:formId', deleteFormSubmission);

module.exports = router;

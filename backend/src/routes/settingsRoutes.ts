import express from 'express';
import { getSettings, updateSettings, getNotificationSettings, updateNotificationSettings } from '../controllers/settingsController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.route('/').get(protect, getSettings).put(protect, updateSettings);
router.route('/notifications').get(protect, getNotificationSettings).put(protect, updateNotificationSettings);

export default router;

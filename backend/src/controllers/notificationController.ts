import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { NotificationService } from '../services/notificationService';

export class NotificationController {
  static async getNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const notifications = await NotificationService.getUserNotifications(userId);
      const unreadCount = await NotificationService.getUnreadCount(userId);
      return res.json({ success: true, notifications, unreadCount });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getUnreadCount(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const count = await NotificationService.getUnreadCount(userId);
      return res.json({ success: true, count, unreadCount: count });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async registerPushToken(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const pushToken = req.body.pushToken || req.body.token;

      if (!pushToken || typeof pushToken !== 'string' || !pushToken.startsWith('ExponentPushToken[')) {
        return res.status(400).json({ success: false, error: 'Valid Expo pushToken is required (ExponentPushToken[...])' });
      }

      await NotificationService.registerPushToken(userId, pushToken);
      return res.json({ success: true, message: 'Push token registered successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async markAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const success = await NotificationService.markAsRead(id, userId);
      return res.json({ success });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async markAllAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const success = await NotificationService.markAllAsRead(userId);
      return res.json({ success });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

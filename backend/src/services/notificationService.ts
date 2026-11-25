import { NotificationItem } from '../types';
import { getSupabase } from '../config/supabase';
import { ENV } from '../config/env';
import { inMemoryMembers } from '../controllers/roomController';

export class NotificationService {
  private static localNotifications: NotificationItem[] = [];
  private static pushTokens = new Map<string, string>(); // userId -> pushToken

  /**
   * Registers or updates an Expo push token for an authenticated user
   */
  static async registerPushToken(userId: string, token: string): Promise<boolean> {
    if (!token || typeof token !== 'string') return false;

    this.pushTokens.set(userId, token);

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('profiles')
          .update({ push_token: token, updated_at: new Date().toISOString() })
          .eq('id', userId);
      } catch (err) {
        console.warn('[NotificationService] Failed to persist push token in Supabase:', err);
      }
    }
    return true;
  }

  /**
   * Dispatches push notification via Expo Push Notification service with retry
   */
  static async sendExpoPush(
    pushToken: string,
    title: string,
    body: string,
    data: Record<string, any> = {},
    retries = 1
  ): Promise<boolean> {
    if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) {
      return false;
    }

    const payload = {
      to: pushToken,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
      channelId: 'budigo_alerts',
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    };

    if (ENV.EXPO_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${ENV.EXPO_ACCESS_TOKEN}`;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          return true;
        }
      } catch (err) {
        if (attempt === retries) {
          console.warn('[NotificationService] Expo Push dispatch failed after retries:', err);
        }
      }
    }
    return false;
  }

  /**
   * Sends an in-app, socket, and push notification to an individual user
   */
  static async sendNotification(
    userId: string,
    roomId: string | undefined,
    title: string,
    message: string,
    type: NotificationItem['notification_type'],
    data: Record<string, any> = {},
    io?: any
  ): Promise<NotificationItem> {
    const notification: NotificationItem = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      user_id: userId,
      room_id: roomId,
      title,
      message,
      notification_type: type,
      data,
      created_at: new Date().toISOString(),
    };

    // 1. Supabase persistence
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('notifications').insert({
          user_id: userId,
          room_id: roomId,
          title,
          message,
          notification_type: type,
          data,
        });
      } catch (err) {
        console.error('[NotificationService] Supabase insert failed:', err);
      }
    } else {
      this.localNotifications.unshift(notification);
      if (this.localNotifications.length > 200) {
        this.localNotifications.pop();
      }
    }

    // 2. Real-time push via Socket.IO
    if (io) {
      if (roomId) {
        io.to(`room:${roomId}`).emit('notification:new', notification);
      } else {
        io.to(`user:${userId}`).emit('notification:new', notification);
      }
    }

    // 3. Physical Device Push Notification via Expo
    const pushToken = this.pushTokens.get(userId);
    if (pushToken) {
      this.sendExpoPush(pushToken, title, message, { roomId, type, ...data });
    }

    return notification;
  }

  /**
   * Broadcasts a notification to all members of a travel room
   */
  static async notifyRoom(
    roomId: string,
    title: string,
    message: string,
    type: NotificationItem['notification_type'],
    data: Record<string, any> = {},
    io?: any,
    excludeUserId?: string
  ) {
    const supabase = getSupabase();
    let recipientIds: string[] = [];

    if (supabase) {
      const { data: members } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', roomId);

      recipientIds = (members || []).map((m: any) => m.user_id);
    } else {
      const members = inMemoryMembers.get(roomId) || [];
      recipientIds = members.map((m) => m.user_id);
    }

    for (const uId of recipientIds) {
      if (excludeUserId && uId === excludeUserId) continue;
      await this.sendNotification(uId, roomId, title, message, type, data, io);
    }
  }

  static async getUserNotifications(userId: string): Promise<NotificationItem[]> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        return data as NotificationItem[];
      }
    }

    return this.localNotifications.filter((n) => n.user_id === userId);
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const supabase = getSupabase();
    if (supabase) {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null);

      return count || 0;
    }

    return this.localNotifications.filter((n) => n.user_id === userId && !n.read_at).length;
  }

  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId);
      return true;
    }

    const n = this.localNotifications.find((item) => item.id === notificationId && item.user_id === userId);
    if (n) {
      n.read_at = new Date().toISOString();
      return true;
    }
    return false;
  }

  static async markAllAsRead(userId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);
      return true;
    }

    for (const n of this.localNotifications) {
      if (n.user_id === userId && !n.read_at) {
        n.read_at = new Date().toISOString();
      }
    }
    return true;
  }
}

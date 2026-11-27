import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Header } from '../../components/common/Header';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { NotificationItem } from '../../types';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    try {
      const token = await api.initToken();
      if (!token) {
        setNotifications([]);
        return;
      }
      const res = await api.getNotifications().catch(() => ({ notifications: [] }));
      setNotifications(res.notifications || []);
    } catch (e) {
      console.warn('[NotificationsScreen] Load error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    socketService.on('notification:new', (notif: NotificationItem) => {
      setNotifications((prev) => [notif, ...prev]);
    });

    return () => {
      socketService.off('notification:new');
    };
  }, []);

  const onNotificationPress = async (item: NotificationItem) => {
    if (!item.read_at) {
      await api.markNotificationRead(item.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    }

    if (item.room_id) {
      router.push(`/room/${item.room_id}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'trip:arrived':
        return '🎉';
      case 'meeting:recommendations':
      case 'meeting:confirmed':
        return '📍';
      case 'room:member-joined':
        return '👋';
      case 'trip:stationary':
        return '⏱️';
      default:
        return '🔔';
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
    } catch (e) {}
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <Header title="Trip Notifications" showBack={false} />
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn} activeOpacity={0.75}>
            <Text style={styles.markReadText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} />}
      >
        {notifications.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔕</Text>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySub}>Trip updates, arrivals, and recommendations will appear here.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {notifications.map((notif) => {
              const isUnread = !notif.read_at;
              return (
                <TouchableOpacity
                  key={notif.id}
                  style={[styles.item, isUnread && styles.itemUnread]}
                  onPress={() => onNotificationPress(notif)}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconCircle}>
                    <Text style={styles.icon}>{getNotificationIcon(notif.notification_type)}</Text>
                  </View>

                  <View style={styles.textContainer}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, isUnread && styles.titleUnread]}>
                        {notif.title}
                      </Text>
                      {isUnread && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.message}>{notif.message}</Text>
                    <Text style={styles.time}>
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  markReadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FAF0E6',
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  scroll: {
    padding: 16,
  },
  empty: {
    padding: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.mutedText,
    textAlign: 'center',
  },
  list: {
    gap: 10,
  },
  item: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    gap: 12,
  },
  itemUnread: {
    backgroundColor: '#FAF5F2',
    borderColor: '#E8D2C2',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  titleUnread: {
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  message: {
    fontSize: 13,
    color: Colors.mutedText,
    marginTop: 3,
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    color: Colors.mutedText,
    marginTop: 6,
  },
});


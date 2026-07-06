// 푸시 알림 (AGENT.md §2) — Expo Notifications 토큰 등록
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 푸시 토큰 발급 후 profiles.push_token에 저장
export async function registerPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return; // 시뮬레이터에서는 푸시 불가

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const res = await Notifications.requestPermissionsAsync();
    status = res.status;
  }
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
}

// 상대에게 직접 푸시 (01단계 시작 알림 등 클라이언트 발신, best effort)
export async function sendPushTo(
  pushToken: string | null,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (!pushToken) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body, data, sound: 'default' }),
    });
  } catch (e) {
    console.warn('push failed', e);
  }
}

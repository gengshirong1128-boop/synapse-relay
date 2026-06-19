import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { relayClient } from '../services/websocket';
import { useAppStore } from '../store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const subRef = useRef<Notifications.EventSubscription | null>(null);
  const connectionState = useAppStore((state) => state.connectionState);

  useEffect(() => {
    if (connectionState !== 'connected') return;
    registerForPush();

    subRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.sessionId) {
          // navigate to session via store
        }
      }
    );

    return () => { subRef.current?.remove(); };
  }, [connectionState]);
}

async function registerForPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '00000000-0000-0000-0000-000000000000',
    });
    relayClient.send({
      type: 'register_push',
      payload: { pushToken: tokenData.data },
    });
  } catch {
    // Push unavailable in Expo Go
  }
}

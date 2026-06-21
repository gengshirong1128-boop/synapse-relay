import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
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
  // Expo push tokens require a real EAS projectId. Until the project runs
  // `eas init` (extra.eas.projectId), there's nothing valid to register — using
  // a placeholder id just throws. So read the real id and skip cleanly if absent.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    relayClient.send({
      type: 'register_push',
      payload: { pushToken: tokenData.data },
    });
  } catch {
    // Push unavailable (e.g. Expo Go without a dev build) — non-fatal.
  }
}

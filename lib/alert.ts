// react-native-web의 Alert.alert는 no-op이라 웹에서 아무 반응도 없다 — 플랫폼 분기로 대체.
import { Alert, Platform } from 'react-native';

export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

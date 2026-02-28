import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#0B1120" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

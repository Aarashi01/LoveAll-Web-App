import { ActivityIndicator, SafeAreaView } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';

export default function IndexScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return <Redirect href={user && !user.isAnonymous ? '/(organizer)/dashboard' : '/(auth)/login'} />;
}

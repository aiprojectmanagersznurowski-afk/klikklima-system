import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { getCurrentSession } from './auth/supabase';
import { LoginScreen } from './screens/LoginScreen';
import { JobsListScreen } from './screens/JobsListScreen';
import { JobDetailsScreen } from './screens/JobDetailsScreen';
import { ConsentsScreen } from './screens/ConsentsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { colors } from './theme';

export type ActiveScreen = 'jobs' | 'job-detail' | 'consents' | 'profile';

export function App() {
  const [session, setSession] = useState(() => getCurrentSession());
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>('jobs');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [hasMissingConsents, setHasMissingConsents] = useState(false);

  // Niezalogowany użytkownik widzi wyłącznie ekran logowania
  if (!session || !session.token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <LoginScreen
          onLoginSuccess={() => {
            setSession(getCurrentSession());
            setCurrentScreen('jobs');
          }}
        />
      </SafeAreaView>
    );
  }

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setCurrentScreen('job-detail');
  };

  const handleMissingConsents = () => {
    setHasMissingConsents(true);
    setCurrentScreen('consents');
  };

  const handleConsentsCompleted = () => {
    setHasMissingConsents(false);
    if (selectedJobId) {
      setCurrentScreen('job-detail');
    } else {
      setCurrentScreen('jobs');
    }
  };

  const handleLogout = () => {
    setSession(null);
    setSelectedJobId(null);
    setCurrentScreen('jobs');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {currentScreen === 'jobs' && (
          <JobsListScreen
            onSelectJob={handleSelectJob}
            onOpenProfile={() => setCurrentScreen('profile')}
            onOpenConsents={() => setCurrentScreen('consents')}
            hasMissingConsents={hasMissingConsents}
          />
        )}

        {currentScreen === 'job-detail' && selectedJobId && (
          <JobDetailsScreen
            jobId={selectedJobId}
            onBack={() => setCurrentScreen('jobs')}
            onMissingConsents={handleMissingConsents}
          />
        )}

        {currentScreen === 'consents' && (
          <ConsentsScreen
            onBack={() => {
              if (selectedJobId) {
                setCurrentScreen('job-detail');
              } else {
                setCurrentScreen('jobs');
              }
            }}
            onAllAccepted={handleConsentsCompleted}
          />
        )}

        {currentScreen === 'profile' && (
          <ProfileScreen
            onBack={() => setCurrentScreen('jobs')}
            onLogout={handleLogout}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

export default App;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.slate50,
  },
  container: {
    flex: 1,
  },
});

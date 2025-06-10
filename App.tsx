import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import RecordingScreen from './src/screens/RecordingScreen';
import RecordingsListScreen from './src/screens/RecordingsListScreen';
import { User, Location } from './src/types';
import { StorageService } from './src/services/StorageService';

type Screen = 'login' | 'recording' | 'recordings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');

  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const savedUser = await StorageService.getUser();
      const savedLocation = await StorageService.getSelectedLocation();
      
      if (savedUser && savedUser.isLoggedIn && savedLocation) {
        setUser(savedUser);
        setLocation(savedLocation);
        setCurrentScreen('recording');
      }
    } catch (error) {
      console.error('Ошибка при проверке авторизации:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (loggedInUser: User, selectedLocation: Location) => {
    setUser(loggedInUser);
    setLocation(selectedLocation);
    setCurrentScreen('recording');
  };

  const handleLogout = () => {
    setUser(null);
    setLocation(null);
    setCurrentScreen('login');
  };

  const handleShowRecordings = () => {
    setCurrentScreen('recordings');
  };

  const handleBackToRecording = () => {
    setCurrentScreen('recording');
  };

  if (isLoading) {
    return <View style={styles.container} />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} />;
      case 'recording':
        return user && location ? (
          <RecordingScreen 
            user={user} 
            location={location} 
            onLogout={handleLogout}
            onShowRecordings={handleShowRecordings}
          />
        ) : <LoginScreen onLogin={handleLogin} />;
      case 'recordings':
        return user ? (
          <RecordingsListScreen 
            user={user} 
            onBack={handleBackToRecording} 
          />
        ) : <LoginScreen onLogin={handleLogin} />;
      default:
        return <LoginScreen onLogin={handleLogin} />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {renderScreen()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

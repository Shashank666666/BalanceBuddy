import React from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { View, StyleSheet, Platform } from 'react-native';

export default function App() {
  const content = (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <AuthProvider>
        <View style={styles.webWrapper}>
          <View style={styles.webContainer}>
            {content}
          </View>
        </View>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      {content}
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    backgroundColor: '#020617', // Very dark background for the outer area
    justifyContent: 'center',
    alignItems: 'center',
  },
  webContainer: {
    width: '100%',
    maxWidth: 450, // Standard mobile frame width
    height: Platform.OS === 'web' ? '95vh' : '100%',
    maxHeight: 900,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    overflow: 'hidden',
    // Adding a subtle shadow to make it look like a phone on the screen
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  }
});

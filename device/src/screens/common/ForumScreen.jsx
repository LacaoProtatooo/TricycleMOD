import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import ForumBoard from '../../components/forum/ForumBoard';
import { colors, spacing } from '../../components/common/theme';

const BACKEND = Constants.expoConfig?.extra?.BACKEND_URL || 'http://192.168.254.105:5000';

const ForumScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Community Forum</Text>
          <Text style={styles.subtitle}>Drivers and operators can chat here</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ForumBoard showHeader backendUrl={BACKEND} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.medium,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.ivory3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginRight: spacing.medium,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  subtitle: {
    color: colors.orangeShade5,
    marginTop: 4,
  },
});

export default ForumScreen;

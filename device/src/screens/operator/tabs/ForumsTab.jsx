import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../components/common/theme';
import ForumBoard from '../../../components/forum/ForumBoard';
import styles from '../operatorStyles';

export default function ForumsTab({ token, BACKEND }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingBottom: 4 }]}>
        <Text style={styles.title}>Forums</Text>
        <Text style={styles.subtitle}>Post announcements or talk to all drivers</Text>
      </View>
      <ForumBoard token={token} backendUrl={BACKEND} />
    </SafeAreaView>
  );
}
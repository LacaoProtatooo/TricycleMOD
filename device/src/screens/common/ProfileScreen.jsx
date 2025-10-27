import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Avatar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../components/common/theme';
import { getUserCredentials } from '../../utils/userStorage';
import defaultAvatar from '../../../assets/ghost.png';

export default function ProfileScreen() {
  const [user, setUser] = useState(null);

  useEffect(() => { fetchUserData(); }, []);

  const fetchUserData = async () => {
    try {
      const userData = await getUserCredentials();
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Avatar.Image source={user?.image?.url ? { uri: user.image.url } : defaultAvatar} size={100} style={styles.profileAvatar} />
          </View>
          <Text style={styles.profileName}>{user?.firstname || 'Driver'} {user?.lastname || ''}</Text>
          <Text style={styles.profileEmail}>{user?.email || 'driver@example.com'}</Text>
          <Text style={styles.profileRole}>Driver</Text>
        </View>

        <View style={styles.menuSection}>
          {[
            { icon: 'person-outline', text: 'Personal Information' },
            { icon: 'document-text-outline', text: 'Documents & License' },
            { icon: 'help-circle-outline', text: 'Help & Support' },
          ].map((m, i) => (
            <TouchableOpacity key={i} style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name={m.icon} size={24} color={colors.primary} />
                <Text style={styles.menuItemText}>{m.text}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.orangeShade5} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={24} color={colors.error} />
              <Text style={[styles.menuItemText, { color: colors.error }]}>Logout</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.orangeShade5} />
          </TouchableOpacity>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Tricycle MOD</Text>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.medium },
  profileHeader: { alignItems: 'center', marginBottom: spacing.large },
  avatarContainer: { position: 'relative', marginBottom: spacing.medium },
  profileAvatar: { borderWidth: 4, borderColor: colors.primary },
  profileName: { fontSize: 24, fontWeight: 'bold', color: colors.orangeShade7, marginBottom: 4 },
  profileEmail: { fontSize: 16, color: colors.orangeShade5, marginBottom: 4 },
  profileRole: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    backgroundColor: colors.primary + '20',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuSection: { marginTop: spacing.large },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    padding: spacing.medium,
    marginBottom: spacing.small,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuItemText: { fontSize: 16, color: colors.orangeShade7, marginLeft: spacing.medium },
  versionContainer: { alignItems: 'center', marginTop: spacing.large * 2, marginBottom: spacing.large },
  versionText: { fontSize: 12, color: colors.orangeShade4, marginBottom: 4 },
});
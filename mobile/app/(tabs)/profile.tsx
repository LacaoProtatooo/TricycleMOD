import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/main/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ProfileScreen() {
  const { user, updateProfile } = useAuth();
  const colorScheme = useColorScheme();
  
  const [plateNumber, setPlateNumber] = useState(user?.plateNumber || '');
  const [address, setAddress] = useState(user?.address || '');
  const [contactNumber, setContactNumber] = useState(user?.contactNumber || '');
  const [operatorName, setOperatorName] = useState(user?.operatorName || '');
  const [driverPicture, setDriverPicture] = useState(user?.driverPicture || '');

  const handleSaveProfile = async () => {
    try {
      await updateProfile({
        plateNumber,
        address,
        contactNumber,
        operatorName,
        driverPicture,
      });
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    }
  };

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setDriverPicture(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleCameraCapture = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setDriverPicture(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Select Photo',
      'Choose how you want to add your driver picture',
      [
        { text: 'Camera', onPress: handleCameraCapture },
        { text: 'Gallery', onPress: handleImagePicker },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#FFE8D6', dark: '#2B1B0F' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="person.circle.fill"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Profile Settings</ThemedText>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Driver Information</ThemedText>
        
        {/* Profile Picture Section */}
        <View style={styles.profilePictureSection}>
          <ThemedText style={styles.fieldLabel}>Driver Picture</ThemedText>
          <Pressable onPress={showImageOptions} style={styles.imagePickerContainer}>
            {driverPicture ? (
              <Image source={{ uri: driverPicture }} style={styles.profileImage} />
            ) : (
              <View style={[styles.placeholderImage, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
                <IconSymbol name="person.fill" size={40} color="#FFFFFF" />
              </View>
            )}
            <View style={styles.cameraIcon}>
              <IconSymbol name="camera.fill" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>

        {/* Plate Number */}
        <View style={styles.inputGroup}>
          <ThemedText style={styles.fieldLabel}>Plate Number</ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: Colors[colorScheme ?? 'light'].background,
              borderColor: Colors[colorScheme ?? 'light'].tint,
              color: Colors[colorScheme ?? 'light'].text 
            }]}
            placeholder="Enter plate number"
            placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
            value={plateNumber}
            onChangeText={setPlateNumber}
          />
        </View>

        {/* Driver Name */}
        <View style={styles.inputGroup}>
          <ThemedText style={styles.fieldLabel}>Driver Name</ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: Colors[colorScheme ?? 'light'].background,
              borderColor: Colors[colorScheme ?? 'light'].tint,
              color: Colors[colorScheme ?? 'light'].text 
            }]}
            placeholder="Enter driver name"
            placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
            value={user?.name || ''}
            editable={false}
          />
        </View>

        {/* Address */}
        <View style={styles.inputGroup}>
          <ThemedText style={styles.fieldLabel}>Address</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea, { 
              backgroundColor: Colors[colorScheme ?? 'light'].background,
              borderColor: Colors[colorScheme ?? 'light'].tint,
              color: Colors[colorScheme ?? 'light'].text 
            }]}
            placeholder="Enter driver address"
            placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Contact Number */}
        <View style={styles.inputGroup}>
          <ThemedText style={styles.fieldLabel}>Contact Number</ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: Colors[colorScheme ?? 'light'].background,
              borderColor: Colors[colorScheme ?? 'light'].tint,
              color: Colors[colorScheme ?? 'light'].text 
            }]}
            placeholder="Enter contact number"
            placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
            value={contactNumber}
            onChangeText={setContactNumber}
            keyboardType="phone-pad"
          />
        </View>

        {/* Operator Name */}
        <View style={styles.inputGroup}>
          <ThemedText style={styles.fieldLabel}>Operator Name</ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: Colors[colorScheme ?? 'light'].background,
              borderColor: Colors[colorScheme ?? 'light'].tint,
              color: Colors[colorScheme ?? 'light'].text 
            }]}
            placeholder="Enter operator name"
            placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
            value={operatorName}
            onChangeText={setOperatorName}
          />
        </View>
      </ThemedView>

      <ThemedView style={styles.section}>
        <Pressable 
          onPress={handleSaveProfile} 
          style={[styles.saveButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
        >
          <ThemedText style={styles.saveButtonText}>Save Profile</ThemedText>
        </Pressable>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  section: {
    gap: 16,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  profilePictureSection: {
    alignItems: 'center',
    gap: 12,
  },
  imagePickerContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
});

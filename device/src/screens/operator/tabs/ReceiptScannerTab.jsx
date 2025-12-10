import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../components/common/theme';
import styles from '../operatorStyles';

export default function ReceiptScannerTab({ token, BACKEND }) {
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Permission to access media library is needed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result?.canceled === true) return;
    const uri = result?.assets?.[0]?.uri || result?.uri;
    if (!uri) {
      Alert.alert('No image selected');
      return;
    }

    setImage(uri);
    setOcrResult(null);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Permission to use camera is needed.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result?.canceled === true) return;
    const uri = result?.assets?.[0]?.uri || result?.uri;
    if (!uri) {
      Alert.alert('No image selected');
      return;
    }

    setImage(uri);
    setOcrResult(null);
  };

  const uploadAndScan = async () => {
    if (!image) {
      Alert.alert('No image', 'Please select or take a photo first');
      return;
    }
    
    if (!token) {
      Alert.alert('Not authenticated', 'Please login');
      return;
    }

    setScanning(true);
    setOcrResult(null);
    
    try {
      const form = new FormData();
      const uriParts = image.split('/');
      const name = uriParts[uriParts.length - 1];
      form.append('image', {
        uri: image,
        name: name,
        type: 'image/jpeg',
      });

      const res = await fetch(`${BACKEND}/api/operator/scan-receipt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: form,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setOcrResult(data.data);
      } else {
        Alert.alert('OCR failed', data.message || 'Failed to scan receipt');
      }
    } catch (error) {
      console.error('Upload error', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setScanning(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { padding: spacing.medium }]}>
      <Text style={styles.title}>Receipt Scanner</Text>
      <Text style={styles.subtitle}>Take or choose a receipt photo to extract text</Text>

      <View style={{ marginTop: spacing.medium, alignItems: 'center' }}>
        {image ? (
          <Image source={{ uri: image }} style={{ width: 280, height: 180, borderRadius: 8 }} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="images" size={48} color={colors.orangeShade5} />
            <Text style={{ color: colors.orangeShade5, marginTop: 8 }}>No image selected</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={pickImage}>
            <Text style={styles.modalBtnText}>Pick Image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} onPress={takePhoto}>
            <Text style={styles.modalBtnText}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.modalBtn, { backgroundColor: '#0d6efd', marginTop: spacing.medium }]} 
          onPress={uploadAndScan} 
          disabled={scanning}
        >
          {scanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.modalBtnText}>Scan Receipt</Text>
          )}
        </TouchableOpacity>

        {ocrResult && (
          <ScrollView style={{ marginTop: spacing.medium, width: '100%', maxHeight: 260 }}>
            <Text style={{ fontWeight: '700', marginBottom: 6 }}>OCR Result</Text>
            {ocrResult.lines && ocrResult.lines.length > 0 ? (
              ocrResult.lines.map((line, idx) => (
                <Text key={idx} style={{ marginBottom: 6 }}>{line.text || line.raw || JSON.stringify(line)}</Text>
              ))
            ) : (
              <Text>No text found</Text>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const receiptStyles = {
  imagePlaceholder: {
    width: 280,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: spacing.medium,
    gap: 8
  }
};
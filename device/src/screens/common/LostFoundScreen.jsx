import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Image, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../components/common/theme';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';
import { API_URL } from '../../utils/config';

const BACKEND = API_URL;

export default function LostFoundScreen() {
  const db = useAsyncSQLiteContext();
  const [token, setToken] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    (async () => {
      if (!db) return;
      const t = await getToken(db);
      setToken(t);
    })();
  }, [db]);

  useEffect(() => {
    if (token) fetchItems();
  }, [token]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/lost-found`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok && json.success) {
        setItems(json.data || []);
      }
    } catch (e) {
      console.warn('lostfound list', e);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission', 'Media permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets?.length) {
      setPhoto(result.assets[0]);
    }
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing', 'Title and description are required');
      return;
    }
    setCreating(true);
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      if (locationText.trim()) form.append('locationText', locationText.trim());
      if (photo) {
        form.append('photo', {
          uri: photo.uri,
          type: photo.mimeType || 'image/jpeg',
          name: photo.fileName || 'photo.jpg',
        });
      }

      const res = await fetch(`${BACKEND}/api/lost-found`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        Alert.alert('Error', json.message || 'Failed to post item');
      } else {
        setTitle('');
        setDescription('');
        setLocationText('');
        setPhoto(null);
        fetchItems();
      }
    } catch (e) {
      console.warn('lostfound post', e);
      Alert.alert('Error', 'Network or server error');
    } finally {
      setCreating(false);
    }
  };

  const markClaimed = async (id) => {
    Alert.alert('Claim item', 'Mark this item as claimed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark claimed',
        onPress: async () => {
          try {
            const res = await fetch(`${BACKEND}/api/lost-found/${id}/claim`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({}),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
              Alert.alert('Error', json.message || 'Unable to mark claimed');
            } else {
              fetchItems();
            }
          } catch (e) {
            console.warn('claim error', e);
            Alert.alert('Error', 'Network or server error');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.status}>{item.status?.toUpperCase?.() || ''}</Text>
      </View>
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.photo} />
      ) : null}
      <Text style={styles.cardText}>{item.description}</Text>
      {item.locationText ? <Text style={styles.cardSub}>Location: {item.locationText}</Text> : null}
      <Text style={styles.cardSub}>Found: {item.foundDate ? new Date(item.foundDate).toLocaleDateString() : '—'}</Text>
      <Text style={styles.cardSub}>Posted by: {item.driver?.firstname} {item.driver?.lastname}</Text>
      {item.status === 'posted' && item.driver?._id === items?.[0]?.driver?._id ? null : null}
      {item.status === 'posted' && (
        <TouchableOpacity style={styles.claimBtn} onPress={() => markClaimed(item._id)}>
          <Text style={styles.claimText}>Mark claimed</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Lost & Found</Text>

        <View style={styles.form}>
          <TextInput
            placeholder="Item title"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
          />
          <TextInput
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            style={[styles.input, { height: 80 }]}
            multiline
          />
          <TextInput
            placeholder="Where was it found?"
            value={locationText}
            onChangeText={setLocationText}
            style={styles.input}
          />
          <View style={styles.photoRow}>
            <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
              <Text style={styles.photoBtnText}>{photo ? 'Change photo' : 'Add photo'}</Text>
            </TouchableOpacity>
            {photo && <Image source={{ uri: photo.uri }} style={styles.thumb} />}
          </View>
          <TouchableOpacity style={[styles.submitBtn, creating && styles.disabled]} onPress={submit} disabled={creating}>
            <Text style={styles.submitText}>{creating ? 'Posting...' : 'Post item'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Recent items</Text>
          <TouchableOpacity onPress={fetchItems} style={{ padding: 6 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            scrollEnabled={false}
            contentContainerStyle={{ gap: spacing.small }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.medium,
    gap: spacing.medium,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  form: {
    backgroundColor: '#fff',
    padding: spacing.medium,
    borderRadius: 12,
    gap: spacing.small,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  input: {
    backgroundColor: colors.ivory1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ivory3,
    paddingHorizontal: spacing.small,
    paddingVertical: 10,
    color: colors.text,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  photoBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: 8,
  },
  photoBtnText: { color: '#fff', fontWeight: '700' },
  thumb: { width: 60, height: 60, borderRadius: 8 },
  submitBtn: {
    backgroundColor: colors.orangeShade7,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade6,
  },
  card: {
    backgroundColor: '#fff',
    padding: spacing.medium,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.orangeShade7 },
  cardText: { color: colors.text },
  cardSub: { color: colors.orangeShade5, fontSize: 12 },
  status: { fontWeight: '700', color: colors.primary },
  photo: { width: '100%', height: 180, borderRadius: 10, marginVertical: 6 },
  claimBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#0d6efd',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: 8,
  },
  claimText: { color: '#fff', fontWeight: '700' },
});

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from '../../components/common/theme';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const BACKEND = (Constants?.manifest?.extra?.BACKEND_URL) || 'http://192.168.254.111:5000';
const Tab = createBottomTabNavigator();

export default function OperatorScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [tricycles, setTricycles] = useState([]);
  const [error, setError] = useState(null);

  // messaging states (shared with Overview)
  const [messages, setMessages] = useState({}); // { [tricycleId]: [{from, text, ts}] }
  const [msgModalVisible, setMsgModalVisible] = useState(false);
  const [selectedTricycle, setSelectedTricycle] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // forums (local fallback)
  const [threads, setThreads] = useState([]);
  const [newThreadText, setNewThreadText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/api/operator/overview`);
        if (!res.ok) throw new Error('No overview endpoint');
        const json = await res.json();
        if (!mounted) return;
        setDrivers(json.drivers || []);
        setTricycles(json.tricycles || []);
      } catch (e) {
        setError(e.message);
        if (!mounted) return;
        // mock fallback
        const mockDrivers = [
          { id: 'd1', name: 'Juan Dela Cruz' },
          { id: 'd2', name: 'Maria Santos' },
          { id: 'd3', name: 'Pedro Reyes' },
        ];
        const mockTricycles = [
          { id: 't1', plate: 'TRI-001', driverId: 'd1', driverName: 'Juan Dela Cruz', status: 'On Duty', schedule: '06:00 - 12:00' },
          { id: 't2', plate: 'TRI-002', driverId: 'd2', driverName: 'Maria Santos', status: 'Idle', schedule: '12:00 - 18:00' },
          { id: 't3', plate: 'TRI-003', driverId: 'd3', driverName: 'Pedro Reyes', status: 'On Trip', schedule: '08:00 - 14:00' },
        ];
        setDrivers(mockDrivers);
        setTricycles(mockTricycles);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // messaging helpers (same as before)
  const openMessage = (tricycle) => {
    setSelectedTricycle(tricycle);
    setMessageText('');
    setMsgModalVisible(true);
  };

  const sendMessage = async () => {
    if (!selectedTricycle) return;
    const text = messageText.trim();
    if (!text) return Alert.alert('Message required', 'Please enter a message.');
    setSending(true);
    const payload = {
      vehicleId: selectedTricycle.id,
      toDriverId: selectedTricycle.driverId || null,
      text,
    };

    try {
      const res = await fetch(`${BACKEND}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Backend send failed');
      const now = new Date().toISOString();
      const msg = { from: 'operator', text, ts: now };
      setMessages((prev) => {
        const arr = prev[selectedTricycle.id] ? [...prev[selectedTricycle.id], msg] : [msg];
        return { ...prev, [selectedTricycle.id]: arr };
      });
      setMsgModalVisible(false);
      Alert.alert('Sent', 'Message sent to driver.');
    } catch (e) {
      const now = new Date().toISOString();
      const msg = { from: 'operator', text, ts: now, offline: true };
      setMessages((prev) => {
        const arr = prev[selectedTricycle.id] ? [...prev[selectedTricycle.id], msg] : [msg];
        return { ...prev, [selectedTricycle.id]: arr };
      });
      setMsgModalVisible(false);
      Alert.alert('Saved locally', 'Message saved locally (no backend).');
    } finally {
      setSending(false);
    }
  };

  // forums helpers (simple local threads; replace with backend calls)
  const postThread = async () => {
    const text = newThreadText.trim();
    if (!text) return Alert.alert('Required', 'Please enter thread content.');
    setPosting(true);
    try {
      // try backend post
      const res = await fetch(`${BACKEND}/api/forums/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const t = await res.json();
        setThreads((prev) => [t, ...prev]);
      } else {
        // fallback local
        setThreads((prev) => [{ id: `local-${Date.now()}`, text, author: 'operator', ts: new Date().toISOString() }, ...prev]);
      }
    } catch (e) {
      setThreads((prev) => [{ id: `local-${Date.now()}`, text, author: 'operator', ts: new Date().toISOString() }, ...prev]);
    } finally {
      setNewThreadText('');
      setPosting(false);
    }
  };

  // Tab screens
  function OverviewTab() {
    if (loading) return <CenterLoader />;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Tricycle overview</Text>
          <Text style={styles.subtitle}>Tap a vehicle to view on map</Text>
        </View>

        {error ? <Text style={styles.noteText}>Using mock data — {error}</Text> : null}

        <FlatList
          data={tricycles}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => {
            const last = (messages[item.id] && messages[item.id].length) ? messages[item.id][messages[item.id].length - 1] : null;
            return (
              <View style={styles.itemWrap}>
                <TouchableOpacity style={styles.item} onPress={() => navigation?.navigate('Home', { vehicleId: item.id })}>
                  <View style={styles.iconWrap}>
                    <Ionicons name="car-sport-outline" size={28} color="#fff" />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.plate}>{item.plate}</Text>
                    <Text style={styles.driver}>{item.driverName || 'Unassigned'}</Text>
                    <Text style={styles.meta}>{item.status} • {item.schedule}</Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={styles.chev}>{'>'}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.messageRow}>
                  <TouchableOpacity style={styles.msgBtn} onPress={() => openMessage(item)}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
                    <Text style={styles.msgBtnText}>Message</Text>
                  </TouchableOpacity>

                  <View style={styles.msgPreview}>
                    {last ? (
                      <Text style={styles.msgPreviewText}>
                        {last.from === 'operator' ? 'You: ' : ''}{last.text.length > 40 ? last.text.slice(0, 40) + '…' : last.text}
                      </Text>
                    ) : (
                      <Text style={styles.msgPreviewTextEmpty}>No messages</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </SafeAreaView>
    );
  }

  function SickLeaveTab() {
    // for demo, derive sick drivers from drivers list by id (mock). Replace with backend data.
    const sick = drivers.filter((d, i) => i % 2 === 0).map((d) => ({ ...d, note: 'Fever, doctor advised 3 days' }));
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Sick Leave Updates</Text>
        </View>
        <FlatList
          data={sick}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <View style={styles.noticeItem}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: colors.orangeShade5 }}>{item.note}</Text>
              </View>
              <Text style={{ color: colors.orangeShade5, fontSize: 12 }}>Since: 2025-10-27</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={{ padding: spacing.medium }}>No sick leave updates</Text>}
        />
      </SafeAreaView>
    );
  }

  function MaintenanceTab() {
    // example maintenance updates from tricycles (mock)
    const maint = tricycles.filter((t, i) => i % 3 === 0).map(t => ({ id: t.id, plate: t.plate, issue: 'Brake check needed', due: '2025-10-28' }));
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Maintenance Updates</Text>
        </View>
        <FlatList
          data={maint}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <View style={styles.noticeItem}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{item.plate}</Text>
                <Text style={{ color: colors.orangeShade5 }}>{item.issue}</Text>
              </View>
              <Text style={{ color: colors.orangeShade5, fontSize: 12 }}>Due: {item.due}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={{ padding: spacing.medium }}>No maintenance updates</Text>}
        />
      </SafeAreaView>
    );
  }

  function ForumsTab() {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { paddingBottom: 4 }]}>
          <Text style={styles.title}>Forums</Text>
          <Text style={styles.subtitle}>Post announcements or talk to all drivers</Text>
        </View>

        <View style={{ padding: spacing.medium }}>
          <TextInput
            style={[styles.textInput, { height: 80 }]}
            placeholder="Write an announcement or start a thread..."
            multiline
            value={newThreadText}
            onChangeText={setNewThreadText}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={postThread} disabled={posting}>
              <Text style={styles.modalBtnText}>{posting ? 'Posting...' : 'Post'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <View style={styles.threadItem}>
              <Text style={{ fontWeight: '700' }}>{item.author || 'Operator'}</Text>
              <Text style={{ color: colors.orangeShade5, marginTop: 4 }}>{item.text}</Text>
              <Text style={{ color: '#999', marginTop: 6, fontSize: 12 }}>{new Date(item.ts || Date.now()).toLocaleString()}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={{ padding: spacing.medium }}>No forum threads yet</Text>}
        />
      </SafeAreaView>
    );
  }

  if (loading) return <CenterLoader />;

  return (
    <>
      <Tab.Navigator
        initialRouteName="Overview"
        screenOptions={{
          tabBarIndicatorStyle: { backgroundColor: colors.primary },
          tabBarActiveTintColor: colors.primary,
          tabBarLabelStyle: { fontWeight: '600' },
          tabBarStyle: { backgroundColor: 'white' },
        }}
      >
        <Tab.Screen name="Overview" component={OverviewTab} />
        <Tab.Screen name="Sick Leave" component={SickLeaveTab} />
        <Tab.Screen name="Maintenance" component={MaintenanceTab} />
        <Tab.Screen name="Forums" component={ForumsTab} />
      </Tab.Navigator>

      {/* Shared message modal */}
      <Modal visible={msgModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Message {selectedTricycle?.plate || ''}</Text>
            <Text style={styles.modalSub}>{selectedTricycle?.driverName || 'No driver assigned'}</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Type a private message..."
              multiline
              value={messageText}
              onChangeText={setMessageText}
              editable={!sending}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} onPress={() => setMsgModalVisible(false)} disabled={sending}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={sendMessage} disabled={sending}>
                <Text style={styles.modalBtnText}>{sending ? 'Sending...' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// small helper component
function CenterLoader() {
  return (
    <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.medium, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: colors.orangeShade7 },
  subtitle: { color: colors.orangeShade5, marginTop: 4 },

  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.medium, justifyContent: 'space-between' },
  statCard: {
    flex: 1,
    backgroundColor: colors.ivory4,
    padding: spacing.medium,
    marginRight: spacing.small,
    borderRadius: 10,
    alignItems: 'center',
  },
  statLabel: { color: colors.orangeShade5, fontSize: 12 },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.orangeShade7, marginTop: 6 },

  noteText: { color: colors.orangeShade5, fontSize: 12, paddingHorizontal: spacing.medium },

  itemWrap: { marginBottom: spacing.small },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory1,
    marginHorizontal: spacing.medium,
    padding: spacing.medium,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.medium,
  },
  info: { flex: 1 },
  plate: { fontWeight: '700', color: colors.orangeShade7 },
  driver: { color: colors.orangeShade5, marginTop: 4 },
  meta: { color: colors.orangeShade5, fontSize: 12, marginTop: 2 },
  right: { width: 24, alignItems: 'flex-end' },
  chev: { color: colors.orangeShade5 },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    marginTop: 8,
    marginBottom: spacing.small,
  },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  msgBtnText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
  msgPreview: { marginLeft: spacing.small, flex: 1 },
  msgPreviewText: { color: colors.orangeShade5, fontSize: 12 },
  msgPreviewTextEmpty: { color: '#999', fontSize: 12 },

  noticeItem: {
    backgroundColor: colors.ivory1,
    marginHorizontal: spacing.medium,
    padding: spacing.medium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ivory3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.small,
  },

  threadItem: {
    backgroundColor: colors.ivory1,
    marginHorizontal: spacing.medium,
    padding: spacing.medium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ivory3,
    marginBottom: spacing.small,
  },

  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    padding: spacing.medium,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.orangeShade7 },
  modalSub: { color: colors.orangeShade5, marginBottom: 8 },
  textInput: {
    height: 100,
    borderWidth: 1,
    borderColor: colors.ivory3,
    borderRadius: 8,
    padding: 10,
    textAlignVertical: 'top',
    marginBottom: spacing.small,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginLeft: 8 },
  modalBtnText: { color: '#fff', fontWeight: '700' },
});
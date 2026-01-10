import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing } from '../common/theme';

const QueueCard = ({ token, BACKEND, assignedTricycle, userId }) => {
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState([]);
  const [joining, setJoining] = useState(false);
  const [terminals, setTerminals] = useState([]);
  const [terminalId, setTerminalId] = useState(null);
  const [coords, setCoords] = useState(null);
  const pollRef = useRef(null);
  const [isFirst, setIsFirst] = useState(false);
  const [locationPerm, setLocationPerm] = useState(null);
  const [autoCancelling, setAutoCancelling] = useState(false);

  const distanceMeters = (a, b) => {
    if (!a || !b) return Infinity;
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const myEntry = useMemo(() => queue.find((q) => String(q.driver?._id || q.driver?.id || q.driver) === String(userId)) || null, [queue, userId]);

  const position = useMemo(() => {
    if (!myEntry) return null;
    const idx = queue.findIndex((q) => String(q._id) === String(myEntry._id));
    return idx === -1 ? null : idx + 1;
  }, [queue, myEntry]);

  // Fetch terminal list
  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${BACKEND}/api/queue/terminals`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (res.ok && json.success) {
          setTerminals(json.data || []);
          if (!terminalId && json.data?.length) setTerminalId(json.data[0].id);
        }
      } catch (e) {
        console.warn('terminals fetch error', e);
      }
    };
    load();
  }, [token]);

  // Fetch queue when terminal changes + start polling
  useEffect(() => {
    const load = async () => {
      if (!token || !terminalId) return;
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND}/api/queue?terminal=${encodeURIComponent(terminalId)}`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (res.ok && json.success) {
          const sorted = (json.data || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          setQueue(sorted);
        }
      } catch (e) {
        console.warn('queue fetch error', e);
      } finally {
        setLoading(false);
      }
    };
    load();

    if (pollRef.current) clearInterval(pollRef.current);
    if (token && terminalId) {
      pollRef.current = setInterval(load, 7000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [token, terminalId]);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'Allow location to verify you are near a terminal.');
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCoords(c);
      return c;
    } catch (e) {
      console.warn('location error', e);
      Alert.alert('Location', 'Unable to get your location.');
      return null;
    }
  };

  const join = async () => {
    if (!token || !assignedTricycle?.bodyNumber || !terminalId) return;
    setJoining(true);
    try {
      const current = coords || (await requestLocation());
      if (!current) { setJoining(false); return; }

      const res = await fetch(`${BACKEND}/api/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          bodyNumber: assignedTricycle.bodyNumber,
          terminal: terminalId,
          latitude: current.latitude,
          longitude: current.longitude,
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await fetch(`${BACKEND}/api/queue?terminal=${encodeURIComponent(terminalId)}`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((j) => {
            if (j.success) {
              const sorted = (j.data || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
              setQueue(sorted);
            }
          });
      } else {
        Alert.alert('Queue', json.message || 'Unable to join queue');
      }
    } catch (e) {
      console.warn('queue join error', e);
      Alert.alert('Queue', 'Network or server error');
    } finally {
      setJoining(false);
    }
  };

  const cancel = async () => {
    if (!token || !myEntry?._id) return;
    setJoining(true);
    try {
      const res = await fetch(`${BACKEND}/api/queue/${myEntry._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setQueue((prev) => prev.filter((q) => String(q._id) !== String(myEntry._id)));
      }
    } catch (e) {
      console.warn('queue cancel error', e);
    } finally {
      setJoining(false);
    }
  };

  const depart = async () => {
    if (!token || !terminalId || position !== 1) return;
    setJoining(true);
    try {
      const res = await fetch(`${BACKEND}/api/queue/advance?terminal=${encodeURIComponent(terminalId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        Alert.alert('Queue', json.message || 'Unable to advance queue');
      }
      // Refresh queue after advance
      await fetch(`${BACKEND}/api/queue?terminal=${encodeURIComponent(terminalId)}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((j) => {
          if (j.success) {
            const sorted = (j.data || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            setQueue(sorted);
          }
        });
    } catch (e) {
      console.warn('depart error', e);
      Alert.alert('Queue', 'Network or server error');
    } finally {
      setJoining(false);
    }
  };

  const autoCancelIfOutside = async () => {
    if (!token || !myEntry || !terminals?.length) return;
    const targetTerminal = terminals.find((t) => t.id === (myEntry.terminal || terminalId));
    if (!targetTerminal) return;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        setLocationPerm(req.status);
        if (req.status !== 'granted') return;
      } else {
        setLocationPerm(perm.status);
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      const dist = distanceMeters(current, { latitude: targetTerminal.latitude, longitude: targetTerminal.longitude });
      const threshold = (targetTerminal.radiusMeters || 120) + 15; // small buffer to reduce jitter

      if (dist > threshold && !autoCancelling) {
        setAutoCancelling(true);
        try {
          // If driver is position 1 (first in queue), treat leaving as a trip departure
          if (position === 1 || myEntry.status === 'called') {
            // Auto-depart: count as trip and advance queue
            const res = await fetch(`${BACKEND}/api/queue/advance?terminal=${encodeURIComponent(myEntry.terminal || terminalId)}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              Alert.alert('Queue', 'You left the terminal zone. Trip counted and queue advanced.');
              // Refresh queue
              const qRes = await fetch(`${BACKEND}/api/queue?terminal=${encodeURIComponent(myEntry.terminal || terminalId)}`, { 
                headers: { Authorization: `Bearer ${token}` } 
              });
              const qJson = await qRes.json();
              if (qJson.success) {
                const sorted = (qJson.data || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                setQueue(sorted);
              }
            }
          } else {
            // Not first in queue - just cancel (remove from queue without counting trip)
            const res = await fetch(`${BACKEND}/api/queue/${myEntry._id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              setQueue((prev) => prev.filter((q) => String(q._id) !== String(myEntry._id)));
              Alert.alert('Queue', 'You left the terminal zone. Removed from queue.');
            }
          }
        } catch (e) {
          console.warn('auto cancel error', e);
        } finally {
          setAutoCancelling(false);
        }
      }
    } catch (e) {
      console.warn('auto cancel locate error', e);
    }
  };

  useEffect(() => {
    if (!myEntry) {
      setIsFirst(false);
      return;
    }
    setIsFirst(Boolean(position === 1 || myEntry.status === 'called'));
  }, [myEntry, position]);

  useEffect(() => {
    if (!token || !myEntry) return;
    let timer;
    const tick = () => {
      autoCancelIfOutside();
    };
    tick();
    timer = setInterval(tick, 12000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [token, myEntry, terminals]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Terminal Queue</Text>
      {assignedTricycle ? (
        <Text style={styles.sub}>Body No: {assignedTricycle.bodyNumber} · Plate: {assignedTricycle.plateNumber}</Text>
      ) : (
        <Text style={styles.sub}>No tricycle assigned.</Text>
      )}

      {isFirst && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>You are up next. Proceed to depart.</Text>
        </View>
      )}

      <View style={styles.terminalRow}>
        <Text style={styles.listTitle}>Terminal</Text>
        <View style={styles.pillRow}>
          {terminals.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.pill, terminalId === t.id && styles.pillActive]}
              onPress={() => setTerminalId(t.id)}
            >
              <Text style={terminalId === t.id ? styles.pillTextActive : styles.pillText}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <>
          {myEntry ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>You are in the queue</Text>
              <Text style={styles.position}>Position: {position ?? '—'}</Text>
              <TouchableOpacity style={[styles.btn, styles.depart, (position !== 1) && styles.disabled]} onPress={depart} disabled={joining || position !== 1}>
                <Text style={styles.btnText}>{joining ? 'Advancing...' : 'Depart / Call next'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={cancel} disabled={joining}>
                <Text style={styles.btnText}>Leave queue</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btn, (!assignedTricycle || !terminalId) && styles.disabled]}
              onPress={join}
              disabled={!assignedTricycle || !terminalId || joining}
            >
              <Text style={styles.btnText}>{joining ? 'Joining...' : 'Join queue'}</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.listTitle}>Current queue ({terminalId || 'select terminal'})</Text>
          {queue.slice(0, 5).map((q, idx) => (
            <View key={q._id} style={styles.row}>
              <Text style={styles.rowText}>{idx + 1}. {q.bodyNumber}</Text>
              <Text style={styles.rowSub}>{q.tricycle?.plateNumber || '—'}</Text>
            </View>
          ))}
          {queue.length === 0 && <Text style={styles.empty}>No one is queued yet.</Text>}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.medium,
    backgroundColor: colors.ivory4,
    padding: spacing.medium,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.orangeShade7 },
  sub: { marginTop: 4, color: colors.orangeShade5, fontSize: 12 },
  center: { padding: spacing.medium, alignItems: 'center' },
  statusBox: { marginTop: spacing.small, padding: spacing.small, backgroundColor: colors.ivory1, borderRadius: 10, borderWidth: 1, borderColor: colors.ivory3 },
  statusText: { color: colors.orangeShade7, fontWeight: '700' },
  position: { marginTop: 4, color: colors.orangeShade5 },
  banner: { marginTop: spacing.small, padding: spacing.small, backgroundColor: '#ffe8cc', borderRadius: 10, borderWidth: 1, borderColor: colors.orangeShade3 },
  bannerText: { color: colors.orangeShade7, fontWeight: '700' },
  btn: { marginTop: spacing.small, backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  depart: { backgroundColor: '#0d6efd' },
  cancel: { backgroundColor: '#b02a37' },
  btnText: { color: colors.ivory1, fontWeight: '700' },
  listTitle: { marginTop: spacing.medium, fontWeight: '700', color: colors.orangeShade6 },
  terminalRow: { marginTop: spacing.small },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xsmall, gap: 6 },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.ivory3, backgroundColor: colors.ivory1 },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.orangeShade7, fontWeight: '600' },
  pillTextActive: { color: colors.ivory1, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.ivory3 },
  rowText: { color: colors.orangeShade7 },
  rowSub: { color: colors.orangeShade5, fontSize: 12 },
  empty: { marginTop: spacing.small, color: colors.orangeShade5 },
});

export default QueueCard;

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Animated } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../common/theme';

const QueueCard = ({ token, BACKEND, assignedTricycle, userId, codingDayStatus }) => {
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
    
    // Check for coding day restriction
    if (codingDayStatus?.isCodingDay) {
      Alert.alert(
        'Coding Day Restriction',
        'You cannot join the queue on your coding day. Please try again tomorrow.',
        [{ text: 'OK' }]
      );
      return;
    }
    
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={22} color="#fff" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Terminal Queue</Text>
            {assignedTricycle ? (
              <View style={styles.tricycleInfo}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{assignedTricycle.bodyNumber}</Text>
                </View>
                <Text style={styles.plateText}>{assignedTricycle.plateNumber}</Text>
              </View>
            ) : (
              <Text style={styles.noTricycle}>No tricycle assigned</Text>
            )}
          </View>
        </View>
        {myEntry && (
          <View style={styles.positionBadge}>
            <Text style={styles.positionNumber}>{position ?? '—'}</Text>
            <Text style={styles.positionLabel}>Position</Text>
          </View>
        )}
      </View>

      {/* First in Queue Banner */}
      {isFirst && (
        <View style={styles.banner}>
          <Ionicons name="notifications" size={20} color="#f59e0b" />
          <Text style={styles.bannerText}>You're up next! Proceed to depart.</Text>
        </View>
      )}

      {/* Terminal Selection */}
      <View style={styles.terminalSection}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="location" size={14} color={colors.orangeShade6} /> Select Terminal
        </Text>
        <View style={styles.terminalGrid}>
          {terminals.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.terminalCard, terminalId === t.id && styles.terminalCardActive]}
              onPress={() => setTerminalId(t.id)}
            >
              <Ionicons 
                name="flag" 
                size={18} 
                color={terminalId === t.id ? '#fff' : colors.orangeShade5} 
              />
              <Text style={[styles.terminalName, terminalId === t.id && styles.terminalNameActive]}>
                {t.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading queue...</Text>
        </View>
      ) : (
        <>
          {/* Status Box when in queue */}
          {myEntry ? (
            <View style={styles.statusBox}>
              <View style={styles.statusHeader}>
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                <Text style={styles.statusTitle}>You're in the Queue!</Text>
              </View>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.departBtn, position !== 1 && styles.disabledBtn]} 
                  onPress={depart} 
                  disabled={joining || position !== 1}
                >
                  <Ionicons name="car" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>
                    {joining ? 'Processing...' : 'Depart'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.leaveBtn]} 
                  onPress={cancel} 
                  disabled={joining}
                >
                  <Ionicons name="exit-outline" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Leave</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.joinBtn, (!assignedTricycle || !terminalId) && styles.disabledBtn]}
              onPress={join}
              disabled={!assignedTricycle || !terminalId || joining}
            >
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.joinBtnText}>
                {joining ? 'Joining Queue...' : 'Join Queue'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Queue List */}
          <View style={styles.queueSection}>
            <View style={styles.queueHeader}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="list" size={14} color={colors.orangeShade6} /> Queue List
              </Text>
              <View style={styles.queueCount}>
                <Text style={styles.queueCountText}>{queue.length}</Text>
              </View>
            </View>
            
            {queue.length === 0 ? (
              <View style={styles.emptyQueue}>
                <Ionicons name="hourglass-outline" size={40} color={colors.ivory3} />
                <Text style={styles.emptyText}>No one in queue</Text>
                <Text style={styles.emptySubtext}>Be the first to join!</Text>
              </View>
            ) : (
              <View style={styles.queueList}>
                {queue.slice(0, 5).map((q, idx) => {
                  const isMe = String(q.driver?._id || q.driver?.id || q.driver) === String(userId);
                  return (
                    <View key={q._id} style={[styles.queueItem, isMe && styles.queueItemHighlight]}>
                      <View style={[styles.queuePosition, idx === 0 && styles.queuePositionFirst]}>
                        <Text style={[styles.queuePositionText, idx === 0 && styles.queuePositionTextFirst]}>
                          {idx + 1}
                        </Text>
                      </View>
                      <View style={styles.queueItemInfo}>
                        <Text style={[styles.queueBodyNumber, isMe && styles.queueTextHighlight]}>
                          {q.bodyNumber}
                          {isMe && <Text style={styles.youTag}> (You)</Text>}
                        </Text>
                        <Text style={styles.queuePlate}>{q.tricycle?.plateNumber || '—'}</Text>
                      </View>
                      {idx === 0 && (
                        <View style={styles.nextBadge}>
                          <Text style={styles.nextBadgeText}>NEXT</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
                {queue.length > 5 && (
                  <Text style={styles.moreText}>+{queue.length - 5} more in queue</Text>
                )}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.medium,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.medium,
    backgroundColor: colors.primary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  tricycleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  plateText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginLeft: 8,
  },
  noTricycle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  positionBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 60,
  },
  positionNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  positionLabel: {
    fontSize: 10,
    color: colors.orangeShade5,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: '#fcd34d',
  },
  bannerText: {
    color: '#92400e',
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  terminalSection: {
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.orangeShade6,
    marginBottom: 10,
  },
  terminalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  terminalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.ivory2,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  terminalCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  terminalName: {
    marginLeft: 6,
    fontWeight: '600',
    color: colors.orangeShade6,
    fontSize: 13,
  },
  terminalNameActive: {
    color: '#fff',
  },
  loadingContainer: {
    padding: spacing.xlarge,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: colors.orangeShade5,
  },
  statusBox: {
    margin: spacing.medium,
    padding: spacing.medium,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#166534',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  departBtn: {
    backgroundColor: '#0d6efd',
  },
  leaveBtn: {
    backgroundColor: '#dc2626',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.medium,
    marginTop: spacing.medium,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  joinBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  queueSection: {
    padding: spacing.medium,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  queueCount: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  queueCountText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyQueue: {
    alignItems: 'center',
    paddingVertical: spacing.large,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade5,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.orangeShade4,
    marginTop: 4,
  },
  queueList: {
    gap: 8,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.ivory2,
  },
  queueItemHighlight: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  queuePosition: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ivory3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queuePositionFirst: {
    backgroundColor: colors.primary,
  },
  queuePositionText: {
    fontWeight: '700',
    color: colors.orangeShade6,
    fontSize: 14,
  },
  queuePositionTextFirst: {
    color: '#fff',
  },
  queueItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  queueBodyNumber: {
    fontWeight: '700',
    color: colors.orangeShade7,
    fontSize: 15,
  },
  queueTextHighlight: {
    color: '#92400e',
  },
  youTag: {
    fontWeight: '600',
    fontSize: 12,
    color: '#f59e0b',
  },
  queuePlate: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  nextBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nextBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  moreText: {
    textAlign: 'center',
    color: colors.orangeShade5,
    fontSize: 13,
    marginTop: 8,
  },
});

export default QueueCard;

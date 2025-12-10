import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing } from './theme';

const TAGUIG = { lat: 14.5176, lon: 121.0509 };
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 95, 96, 99]);
const DEFAULT_HEAT_THRESHOLD = 31;

const buildSignature = (tips) => tips
  .map((tip) => tip.id)
  .sort()
  .join('|');

const WeatherAdvisoryModal = ({ latitude, longitude, temperatureThreshold = DEFAULT_HEAT_THRESHOLD }) => {
  const [tips, setTips] = useState([]);
  const [visible, setVisible] = useState(false);
  const [activeSignature, setActiveSignature] = useState(null);
  const dismissedSignatureRef = useRef(null);

  const targetCoords = useMemo(() => ({
    lat: typeof latitude === 'number' ? latitude : TAGUIG.lat,
    lon: typeof longitude === 'number' ? longitude : TAGUIG.lon,
  }), [latitude, longitude]);

  useEffect(() => {
    let mounted = true;

    const fetchWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${targetCoords.lat}&longitude=${targetCoords.lon}&hourly=temperature_2m,weathercode&current_weather=true&timezone=Asia%2FManila`;
        const res = await fetch(url);
        const json = await res.json();
        if (!mounted || !json) return;

        const currentTemp = json.current_weather?.temperature ?? null;
        const times = json.hourly?.time || [];
        const codes = json.hourly?.weathercode || [];

        const dtf = new Intl.DateTimeFormat('en', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          hour12: false,
        });
        const parts = dtf.formatToParts(new Date());
        const year = parts.find((p) => p.type === 'year')?.value;
        const month = parts.find((p) => p.type === 'month')?.value;
        const day = parts.find((p) => p.type === 'day')?.value;
        const hour = parts.find((p) => p.type === 'hour')?.value;
        const nowIsoHour = `${year}-${month}-${day}T${hour}`;
        const nowIndex = times.findIndex((t) => t.startsWith(nowIsoHour));
        const nextHourCode = (nowIndex !== -1 && codes[nowIndex + 1] !== undefined)
          ? codes[nowIndex + 1]
          : codes[0];

        const nextTips = [];

        if (RAIN_CODES.has(Number(nextHourCode))) {
          nextTips.push({
            id: 'rain',
            title: 'Rain expected within an hour',
            message: 'Ground may turn slippery quickly. Plan a safer route and suit up.',
            checklist: ['Raincoat or poncho', 'Waterproof boots'],
          });
        }

        if (typeof currentTemp === 'number' && currentTemp >= temperatureThreshold) {
          nextTips.push({
            id: 'heat',
            title: `It feels hot (${Math.round(currentTemp)}°C)`,
            message: 'Stay hydrated while waiting or between trips.',
            checklist: ['Drinking water / tumbler'],
          });
        }

        setTips(nextTips);
        const signature = buildSignature(nextTips);
        setActiveSignature(signature || null);

        if (nextTips.length === 0) {
          setVisible(false);
          return;
        }

        if (signature && dismissedSignatureRef.current !== signature) {
          setVisible(true);
        }
      } catch (error) {
        console.warn('Weather advisory fetch failed', error?.message || error);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [targetCoords, temperatureThreshold]);

  const dismiss = () => {
    if (activeSignature) {
      dismissedSignatureRef.current = activeSignature;
    }
    setVisible(false);
  };

  if (!visible || tips.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.heading}>Weather Heads-up</Text>
          <Text style={styles.subheading}>Pack a few extras before you go.</Text>

          {tips.map((tip) => (
            <View key={tip.id} style={styles.tipBlock}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipMessage}>{tip.message}</Text>
              <View style={styles.checklist}>
                {tip.checklist.map((item) => (
                  <View key={`${tip.id}-${item}`} style={styles.checkItem}>
                    <View style={styles.bullet} />
                    <Text style={styles.checkText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.primaryBtn} onPress={dismiss}>
            <Text style={styles.primaryBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.large,
  },
  card: {
    width: '100%',
    backgroundColor: colors.ivory1,
    padding: spacing.large,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade7,
  },
  subheading: {
    marginTop: spacing.xsmall,
    color: colors.orangeShade5,
    fontSize: 13,
  },
  tipBlock: {
    marginTop: spacing.medium,
    padding: spacing.medium,
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  tipMessage: {
    marginTop: spacing.xsmall,
    color: colors.orangeShade5,
    fontSize: 13,
  },
  checklist: {
    marginTop: spacing.small,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: spacing.small,
  },
  checkText: {
    fontSize: 14,
    color: colors.orangeShade7,
  },
  primaryBtn: {
    marginTop: spacing.large,
    backgroundColor: colors.primary,
    paddingVertical: spacing.small,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.ivory1,
    fontWeight: '700',
    fontSize: 15,
  },
});

export default WeatherAdvisoryModal;

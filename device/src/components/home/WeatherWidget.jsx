import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing } from '../../components/common/theme';

/**
 * WeatherWidget (Taguig default)
 * - Uses Open-Meteo (no API key)
 * - Default location: Taguig City (lat: 14.5176, lon: 121.0509)
 * - Shows only the next `hours` forecasts (default 6)
 * - Uses Asia/Manila timezone for indexing forecasts (prevents UTC mismatch)
 */
export default function WeatherWidget({ latitude: propLat, longitude: propLon, hours = 6 }) {
  const TAGUIG = { lat: 14.5176, lon: 121.0509 };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(null);
  const [hourly, setHourly] = useState([]);

  useEffect(() => {
    let mounted = true;
    const fetchWeather = async () => {
      try {
        const lat = (typeof propLat === 'number') ? propLat : TAGUIG.lat;
        const lon = (typeof propLon === 'number') ? propLon : TAGUIG.lon;

        // Request output times already converted to Asia/Manila
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode&current_weather=true&timezone=Asia%2FManila`;
        const res = await fetch(url);
        const json = await res.json();
        if (!json) throw new Error('No data from weather API');
        if (!mounted) return;

        setCurrent(json.current_weather || null);

        const times = json.hourly?.time || [];
        const temps = json.hourly?.temperature_2m || [];
        const codes = json.hourly?.weathercode || [];

        // Build an ISO-hour string for the current time in Asia/Manila (YYYY-MM-DDTHH)
        // Use Intl to get Manila components reliably regardless of device timezone
        const dtf = new Intl.DateTimeFormat('en', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          hour12: false,
        });
        const parts = dtf.formatToParts(new Date());
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;
        const hour = parts.find(p => p.type === 'hour')?.value;
        const nowIsoHour = `${year}-${month}-${day}T${hour}`;

        // Find index of current Manila hour and start from next hour
        const nowIndex = times.findIndex((t) => t.startsWith(nowIsoHour));
        const start = (nowIndex !== -1) ? nowIndex + 1 : 0;

        const list = [];
        for (let i = start; i < Math.min(times.length, start + hours); i++) {
          list.push({ time: times[i], temp: temps[i], code: codes[i] });
        }
        setHourly(list);
        setError(null);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchWeather();
    const intervalMs = 10 * 60 * 1000; // poll every 10 min
    const timer = setInterval(fetchWeather, intervalMs);
    return () => { mounted = false; clearInterval(timer); };
  }, [propLat, propLon, hours]);

  const weatherCodeToText = (code) => {
    if (code === 0) return 'Clear';
    if ([1,2,3].includes(code)) return 'Partly cloudy';
    if ([45,48].includes(code)) return 'Fog';
    if ([51,53,55,56,57].includes(code)) return 'Drizzle';
    if ([61,63,65,66,67].includes(code)) return 'Rain';
    if ([71,73,75,77].includes(code)) return 'Snow';
    if ([80,81,82].includes(code)) return 'Rain showers';
    if ([95,96,99].includes(code)) return 'Thunderstorm';
    return 'Unknown';
  };

  if (loading) return (
    <View style={[styles.card, styles.center]}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.loadingText}>Loading weather...</Text>
    </View>
  );

  if (error) return (
    <View style={[styles.card, styles.center]}>
      <Text style={styles.loadingText}>Weather unavailable: {error}</Text>
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Weather — Taguig City</Text>

      <View style={styles.currentRow}>
        <View>
          <Text style={styles.currentTemp}>{current?.temperature ?? '--'}°C</Text>
          <Text style={styles.currentDesc}>{weatherCodeToText(current?.weathercode)}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.small}>Wind: {current?.windspeed ?? '--'} km/h</Text>
          <Text style={styles.small}>Direction: {current?.winddirection ?? '--'}°</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyScroll}>
        {hourly.map((h, i) => {
          // times returned by API are in Asia/Manila thanks to timezone param
          const hourLabel = h.time.slice(11,16); // "HH:MM"
          return (
            <View key={i} style={styles.hourItem}>
              <Text style={styles.hourText}>{hourLabel}</Text>
              <Text style={styles.hourTemp}>{Math.round(h.temp)}°</Text>
              <Text style={styles.hourDesc}>{weatherCodeToText(h.code)}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.medium,
    backgroundColor: colors.ivory4,
    padding: spacing.medium,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.orangeShade7, marginBottom: spacing.small },
  loadingText: { marginTop: spacing.xsmall, color: colors.orangeShade5 },
  currentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  currentTemp: { fontSize: 28, fontWeight: '700', color: colors.primary },
  currentDesc: { fontSize: 14, color: colors.orangeShade5 },
  meta: { alignItems: 'flex-end' },
  small: { fontSize: 12, color: colors.orangeShade5 },
  hourlyScroll: { marginTop: spacing.small },
  hourItem: { padding: spacing.small, marginRight: spacing.small, backgroundColor: colors.ivory1, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  hourText: { fontSize: 12, color: colors.orangeShade5 },
  hourTemp: { fontSize: 18, fontWeight: '700', color: colors.orangeShade7, marginVertical: 4 },
  hourDesc: { fontSize: 12, color: colors.orangeShade5, textAlign: 'center' },
});
import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

type Place = {
  id: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
};

export default function MapsScreen() {
  const colorScheme = useColorScheme();
  const mapRef = useRef<MapView | null>(null);

  const initialRegion: Region = {
    latitude: 14.5995,
    longitude: 120.9842,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  };

  const [region, setRegion] = useState<Region>(initialRegion);

  const places = useMemo<Place[]>(
    () => [
      { id: '1', title: 'Main Terminal', description: 'Central hub', latitude: 14.5995, longitude: 120.9842 },
      { id: '2', title: 'Service Shop', description: 'Recommended maintenance', latitude: 14.6050, longitude: 120.9800 },
      { id: '3', title: 'Scenic Spot', description: 'Nice view', latitude: 14.6100, longitude: 120.9900 },
    ],
    []
  );

  function centerOnPlace(p: Place) {
    const r: Region = {
      latitude: p.latitude,
      longitude: p.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(r);
    mapRef.current?.animateToRegion(r, 350);
  }

  function zoom(delta: number) {
    const newRegion = {
      ...region,
      latitudeDelta: Math.max(0.001, region.latitudeDelta * delta),
      longitudeDelta: Math.max(0.001, region.longitudeDelta * delta),
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 250);
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#E6F7FF', dark: '#062A3A' }}
      headerImage={<Image source={require('@/assets/images/partial-react-logo.png')} style={styles.headerImage} />}
    >
      <ThemedView style={styles.container}>
        <ThemedText type="title">Maps</ThemedText>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Nearby places</ThemedText>

          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={initialRegion}
              region={region}
              onRegionChangeComplete={setRegion}
              showsUserLocation={true}
              showsMyLocationButton={true}
            >
              {places.map((p) => (
                <Marker
                  key={p.id}
                  coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                  title={p.title}
                  description={p.description}
                  pinColor="#4285F4" // Google blue
                />
              ))}
            </MapView>

            <View style={styles.controls}>
              <Pressable
                onPress={() => zoom(0.7)}
                style={[styles.controlButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
              >
                <ThemedText style={styles.controlText}>+</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => zoom(1.4)}
                style={[styles.controlButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
              >
                <ThemedText style={styles.controlText}>−</ThemedText>
              </Pressable>
            </View>
          </View>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">Quick actions</ThemedText>
          <View style={styles.placesRow}>
            {places.map((p) => (
              <Pressable key={p.id} onPress={() => centerOnPlace(p)} style={styles.placeCard}>
                <ThemedText style={styles.placeTitle}>{p.title}</ThemedText>
                <ThemedText style={{ opacity: 0.8 }}>{p.description}</ThemedText>
              </Pressable>
            ))}
          </View>
        </ThemedView>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  headerImage: {
    height: 140,
    width: 260,
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  section: {
    gap: 8,
    marginBottom: 12,
  },
  mapContainer: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  controls: {
    position: 'absolute',
    right: 12,
    top: 12,
    gap: 8,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  controlText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  placesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  placeCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  placeTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
});

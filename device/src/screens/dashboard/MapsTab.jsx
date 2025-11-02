import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { colors } from '../../components/common/theme';
import TrackingMap from '../../components/home/TrackingMap';

const MapsTab = () => {
  return (
    <SafeAreaView style={styles.container}>
      <TrackingMap />
    </SafeAreaView>
  );
};

export default MapsTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

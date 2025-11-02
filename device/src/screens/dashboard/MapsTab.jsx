import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

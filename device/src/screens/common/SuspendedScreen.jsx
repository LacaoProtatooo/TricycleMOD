import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../redux/actions/authAction';
import { colors, spacing, globalStyles } from '../../components/common/theme';

const windowWidth = Dimensions.get('window').width;

const SuspendedScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Calculate remaining days
  const getRemainingDays = () => {
    if (!user?.suspendedUntil) return 'Unknown';
    const now = new Date();
    const until = new Date(user.suspendedUntil);
    const diffTime = until - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const handleContactOperator = () => {
    // You can customize this to open email, phone, or messaging
    Linking.openURL('mailto:webttoda.official@gmail.com?subject=Suspension Appeal');
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Gradient */}
      <LinearGradient
        colors={[colors.orangeShade8, colors.orangeShade6, colors.orangeShade4]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerPattern}>
          {/* Decorative circles */}
          <View style={[styles.decorativeCircle, styles.circle1]} />
          <View style={[styles.decorativeCircle, styles.circle2]} />
          <View style={[styles.decorativeCircle, styles.circle3]} />
        </View>
        
        <View style={styles.headerContent}>
          <View style={styles.suspendedIconContainer}>
            <Ionicons name="ban-outline" size={60} color={colors.ivory1} />
          </View>
          <Text style={styles.headerTitle}>Account Suspended</Text>
          <Text style={styles.headerSubtitle}>
            Your driving privileges have been temporarily revoked
          </Text>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.contentContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Suspension Details Card */}
        <View style={styles.detailsCard}>
          <LinearGradient
            colors={['rgba(255, 95, 0, 0.1)', 'rgba(255, 140, 0, 0.05)']}
            style={styles.cardGradient}
          >
            <View style={styles.cardHeader}>
              <Ionicons name="alert-circle" size={24} color={colors.orangeShade7} />
              <Text style={styles.cardTitle}>Suspension Details</Text>
            </View>

            {/* Driver Info */}
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="person" size={18} color={colors.orangeShade5} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Driver</Text>
                <Text style={styles.infoValue}>
                  {user?.firstname} {user?.lastname}
                </Text>
              </View>
            </View>

            {/* Suspension Until */}
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="calendar" size={18} color={colors.orangeShade5} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Suspended Until</Text>
                <Text style={styles.infoValue}>
                  {formatDate(user?.suspendedUntil)}
                </Text>
              </View>
            </View>

            {/* Days Remaining */}
            <View style={styles.daysRemainingContainer}>
              <LinearGradient
                colors={[colors.orangeShade6, colors.orangeShade8]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.daysRemainingGradient}
              >
                <Text style={styles.daysRemainingNumber}>{getRemainingDays()}</Text>
                <Text style={styles.daysRemainingLabel}>Days Remaining</Text>
              </LinearGradient>
            </View>

            {/* Reason */}
            {user?.suspensionReason && (
              <View style={styles.reasonContainer}>
                <Text style={styles.reasonLabel}>Reason for Suspension</Text>
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonText}>{user.suspensionReason}</Text>
                </View>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Information Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Ionicons name="information-circle" size={24} color={colors.primary} />
            <Text style={styles.infoCardTitle}>What does this mean?</Text>
          </View>
          <Text style={styles.infoCardText}>
            During your suspension period, you are temporarily unable to:
          </Text>
          <View style={styles.restrictionsList}>
            <View style={styles.restrictionItem}>
              <Ionicons name="close-circle" size={18} color={colors.error} />
              <Text style={styles.restrictionText}>Accept or complete bookings</Text>
            </View>
            <View style={styles.restrictionItem}>
              <Ionicons name="close-circle" size={18} color={colors.error} />
              <Text style={styles.restrictionText}>Join the driver queue</Text>
            </View>
            <View style={styles.restrictionItem}>
              <Ionicons name="close-circle" size={18} color={colors.error} />
              <Text style={styles.restrictionText}>Access tracking features</Text>
            </View>
          </View>
          <Text style={styles.infoCardText}>
            You can still view announcements and messages during this period.
          </Text>
        </View>

        {/* Appeal Information Card */}
        <View style={styles.appealCard}>
          <LinearGradient
            colors={['rgba(76, 175, 80, 0.1)', 'rgba(76, 175, 80, 0.05)']}
            style={styles.appealGradient}
          >
            <View style={styles.appealHeader}>
              <Ionicons name="help-circle" size={24} color="#4CAF50" />
              <Text style={styles.appealTitle}>Think this is a mistake?</Text>
            </View>
            <Text style={styles.appealText}>
              If you believe your suspension was made in error, please contact your operator or WEBTTODA official immediately to appeal this decision.
            </Text>
            <TouchableOpacity 
              style={styles.contactButton}
              onPress={handleContactOperator}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4CAF50', '#45a049']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.contactButtonGradient}
              >
                <Ionicons name="mail" size={20} color="#fff" />
                <Text style={styles.contactButtonText}>Contact Support</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.orangeShade7} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            WEBTTODA Driver Management System
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGradient: {
    paddingTop: spacing.large,
    paddingBottom: spacing.large * 1.5,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  headerPattern: {
    ...StyleSheet.absoluteFillObject,
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  circle1: {
    width: 150,
    height: 150,
    top: -50,
    right: -30,
  },
  circle2: {
    width: 100,
    height: 100,
    bottom: -30,
    left: -20,
  },
  circle3: {
    width: 60,
    height: 60,
    top: 20,
    left: windowWidth * 0.3,
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.large,
  },
  suspendedIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.medium,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.ivory1,
    marginBottom: spacing.small / 2,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: spacing.large,
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.medium,
    paddingTop: spacing.large,
    paddingBottom: spacing.large * 2,
  },
  detailsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.2)',
    elevation: 3,
    shadowColor: colors.orangeShade6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardGradient: {
    padding: spacing.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium,
    paddingBottom: spacing.small,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 140, 0, 0.2)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.orangeShade8,
    marginLeft: spacing.small,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.small,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 140, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.placeholder,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  daysRemainingContainer: {
    marginTop: spacing.medium,
    alignItems: 'center',
  },
  daysRemainingGradient: {
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.large * 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  daysRemainingNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.ivory1,
  },
  daysRemainingLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  reasonContainer: {
    marginTop: spacing.medium,
  },
  reasonLabel: {
    fontSize: 12,
    color: colors.placeholder,
    marginBottom: spacing.small / 2,
  },
  reasonBox: {
    backgroundColor: 'rgba(255, 140, 0, 0.1)',
    padding: spacing.small,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.orangeShade6,
  },
  reasonText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.15)',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: spacing.small / 2,
  },
  infoCardText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.small,
  },
  restrictionsList: {
    marginVertical: spacing.small,
  },
  restrictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  restrictionText: {
    fontSize: 13,
    color: colors.text,
    marginLeft: spacing.small / 2,
  },
  appealCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  appealGradient: {
    padding: spacing.medium,
  },
  appealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  appealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: spacing.small / 2,
  },
  appealText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.medium,
  },
  contactButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  contactButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.medium,
  },
  contactButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginLeft: spacing.small / 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.orangeShade5,
    backgroundColor: 'rgba(255, 140, 0, 0.08)',
    marginBottom: spacing.medium,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.orangeShade7,
    marginLeft: spacing.small / 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.small,
  },
  footerText: {
    fontSize: 11,
    color: colors.placeholder,
  },
});

export default SuspendedScreen;

import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  Dimensions, 
  TouchableOpacity,
  Linking,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../components/common/theme';
import { LinearGradient } from 'expo-linear-gradient';

const windowWidth = Dimensions.get('window').width;

const About = () => {
  const developers = [
    {
      name: "Donn Anthony Baldoza",
      image: require("../../../assets/marisa.gif"),
      role: "Lead Developer",
      github: "https://github.com/LacaoProtatooo"
    },
    {
      name: "Henrich Lacao",
      image: require("../../../assets/reimu.gif"),
      role: "Backend Developer",
      github: "https://github.com/LacaoProtatooo"
    },
    {
      name: "Juliana Mae Ines",
      image: require("../../../assets/marisa.gif"),
      role: "UI/UX Developer",
      github: "https://github.com/LacaoProtatooo"
    }
  ];

  const advisor = {
    name: "Dr. Rico S. Santos",
    image: require("../../../assets/doc_rico.jpg"),
    role: "Technical Advisor",
    title: "Former MTICS Adviser '20-'23",
    institution: "Technological University of the Philippines"
  };

  const openLink = (url) => {
    Linking.openURL(url).catch(err =>
      console.error("Couldn't open link", err)
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section with Logo */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoGlow}>
              <View style={styles.logoBackground}>
                <Image 
                  source={require("../../../assets/webttrac_logo_bgrm.png")} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>
          
          <Text style={styles.appTitle}>WEBT-TRaC</Text>
          <Text style={styles.subtitle}>
            Western Bicutan Tenement – Tricycle Regulatory and Compliance
          </Text>
        </View>

        {/* Main Content Card */}
        <View style={styles.mainCard}>
          <View style={styles.decorativeLine} />
          
          <Text style={styles.introText}>
            A mobile application designed to enhance tricycle regulation, safety, and operational
            compliance within the Western Bicutan Tenement community.
          </Text>

          {/* Mission Quote */}
          <View style={styles.missionCard}>
            <View style={styles.quoteIconContainer}>
              <Ionicons name="bulb" size={28} color={colors.primary} />
            </View>
            <Text style={styles.missionTitle}>Our Mission</Text>
            <Text style={styles.missionText}>
              "Technology empowering safer, organized, and accountable tricycle operations."
            </Text>
          </View>

          {/* About Description */}
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>What We Do</Text>
            <Text style={styles.bodyText}>
              WEBT-TRaC primarily assists the Western Bicutan Tenement Tricycle Operators and Driver's
              Association (WEBTTODA) by providing digital tools that support regulatory compliance,
              operational monitoring, and effective communication among drivers, operators, and
              administrators.
            </Text>
          </View>

          {/* Features Grid */}
          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>Key Features</Text>
            <View style={styles.featuresGrid}>
              <View style={styles.featureCard}>
                <View style={[styles.featureIconWrapper, { backgroundColor: colors.orangeShade2 }]}>
                  <Ionicons name="shield-checkmark" size={32} color={colors.ivory1} />
                </View>
                <Text style={styles.featureTitle}>Regulatory Compliance</Text>
                <Text style={styles.featureDescription}>
                  Ensures that tricycle drivers and operators comply with local regulations
                  and association policies.
                </Text>
              </View>

              <View style={styles.featureCard}>
                <View style={[styles.featureIconWrapper, { backgroundColor: colors.orangeShade4 }]}>
                  <Ionicons name="people" size={32} color={colors.ivory1} />
                </View>
                <Text style={styles.featureTitle}>Operational Support</Text>
                <Text style={styles.featureDescription}>
                  Assists WEBTTODA in managing driver records, announcements, and daily operations.
                </Text>
              </View>

              <View style={styles.featureCard}>
                <View style={[styles.featureIconWrapper, { backgroundColor: colors.orangeShade6 }]}>
                  <Ionicons name="bicycle" size={32} color={colors.ivory1} />
                </View>
                <Text style={styles.featureTitle}>Community Safety</Text>
                <Text style={styles.featureDescription}>
                  Promotes road safety awareness, accountability, and responsible tricycle services.
                </Text>
              </View>
            </View>
          </View>

          {/* Impact Section */}
          <View style={styles.impactSection}>
            <Text style={styles.sectionTitle}>Our Impact</Text>
            <View style={styles.impactCard}>
              <View style={styles.impactItem}>
                <Ionicons name="trending-up" size={24} color={colors.primary} />
                <Text style={styles.impactText}>
                  Improved transparency and efficiency in operations
                </Text>
              </View>
              <View style={styles.impactItem}>
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                <Text style={styles.impactText}>
                  Enhanced regulatory compliance and accountability
                </Text>
              </View>
              <View style={styles.impactItem}>
                <Ionicons name="heart" size={24} color={colors.primary} />
                <Text style={styles.impactText}>
                  Supporting long-term community development
                </Text>
              </View>
            </View>
          </View>

          {/* Community Statement */}
          <View style={styles.communityCard}>
            <Ionicons name="people-circle" size={48} color={colors.primary} />
            <Text style={styles.communityText}>
              Built in collaboration with the community, for the community — helping
              ensure safer roads, organized transport services, and a more accountable tricycle
              system in Western Bicutan.
            </Text>
          </View>
        </View>

        {/* Team Section */}
        <View style={styles.teamSection}>
          <Text style={styles.teamMainTitle}>Meet Our Team</Text>
          <Text style={styles.teamSubtitle}>The minds behind WEBT-TRaC</Text>
          <View style={styles.teamDivider} />

          <View style={styles.developersGrid}>
            {developers.map((dev, index) => (
              <TouchableOpacity
                key={index}
                style={styles.developerCard}
                onPress={() => openLink(dev.github)}
                activeOpacity={0.8}
              >
                <View style={styles.cardGradient}>
                  <View style={styles.developerImageWrapper}>
                    <View style={styles.imageGlow}>
                      <Image source={dev.image} style={styles.developerImage} />
                    </View>
                  </View>
                  
                  <View style={styles.developerInfo}>
                    <Text style={styles.developerName}>{dev.name}</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.developerRole}>{dev.role}</Text>
                    </View>
                  </View>

                  <TouchableOpacity 
                    style={styles.githubButton}
                    onPress={() => openLink(dev.github)}
                  >
                    <Ionicons name="logo-github" size={18} color={colors.ivory1} />
                    <Text style={styles.githubText}>View GitHub</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Technical Advisor Section */}
        <View style={styles.advisorSection}>
          <Text style={styles.advisorMainTitle}>Technical Advisor</Text>
          <Text style={styles.advisorSubtitle}>Guiding our technical direction</Text>
          <View style={styles.teamDivider} />
          
          <View style={styles.advisorCard}>
            <View style={styles.advisorImageWrapper}>
              <View style={styles.advisorImageGlow}>
                <Image source={advisor.image} style={styles.advisorImage} />
              </View>
            </View>
            
            <View style={styles.advisorInfo}>
              <Text style={styles.advisorName}>{advisor.name}</Text>
              <View style={styles.advisorRoleBadge}>
                <Ionicons name="school" size={14} color={colors.ivory1} />
                <Text style={styles.advisorRoleText}>{advisor.role}</Text>
              </View>
              <Text style={styles.advisorTitle}>{advisor.title}</Text>
              <Text style={styles.advisorInstitution}>{advisor.institution}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <Text style={styles.footerTitle}>WEBT-TRaC</Text>
            <Text style={styles.footerText}>
              Western Bicutan Tenement
            </Text>
            <Text style={styles.footerCopyright}>
              © {new Date().getFullYear()} All Rights Reserved
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingBottom: spacing.large,
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.large * 2,
    paddingHorizontal: spacing.medium,
  },
  logoContainer: {
    marginBottom: spacing.large,
  },
  logoGlow: {
    padding: 8,
    borderRadius: 100,
    backgroundColor: colors.ivory2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoBackground: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.ivory1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.orangeShade2,
  },
  logo: {
    width: 240,
    height: 240,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: 2,
    marginBottom: spacing.small,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  subtitle: {
    fontSize: 14,
    color: colors.orangeShade8,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },

  // Main Card
  mainCard: {
    backgroundColor: colors.ivory1,
    marginHorizontal: spacing.medium,
    borderRadius: 20,
    padding: spacing.large,
    shadowColor: colors.orangeShade8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: spacing.large,
  },
  decorativeLine: {
    height: 4,
    width: 80,
    backgroundColor: colors.primary,
    alignSelf: 'center',
    borderRadius: 2,
    marginBottom: spacing.large,
  },
  introText: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.large,
  },

  // Mission Card
  missionCard: {
    backgroundColor: colors.ivory3,
    borderRadius: 16,
    padding: spacing.large,
    alignItems: 'center',
    marginBottom: spacing.large,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  quoteIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ivory1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.medium,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  missionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.orangeShade8,
    marginBottom: spacing.small,
  },
  missionText: {
    fontSize: 17,
    fontStyle: 'italic',
    color: colors.orangeShade7,
    textAlign: 'center',
    lineHeight: 26,
  },

  // Description Section
  descriptionSection: {
    marginBottom: spacing.large,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.medium,
    textAlign: 'center',
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'center',
  },

  // Features Section
  featuresSection: {
    marginBottom: spacing.large,
  },
  featuresGrid: {
    gap: spacing.medium,
  },
  featureCard: {
    backgroundColor: colors.ivory2,
    borderRadius: 16,
    padding: spacing.large,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  featureIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.medium,
    shadowColor: colors.orangeShade8,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade8,
    marginBottom: spacing.small,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Impact Section
  impactSection: {
    marginBottom: spacing.large,
  },
  impactCard: {
    backgroundColor: colors.ivory3,
    borderRadius: 16,
    padding: spacing.large,
    gap: spacing.medium,
  },
  impactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
  },
  impactText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },

  // Community Card
  communityCard: {
    backgroundColor: colors.orangeShade1,
    borderRadius: 16,
    padding: spacing.large,
    alignItems: 'center',
    gap: spacing.medium,
  },
  communityText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.orangeShade9,
    textAlign: 'center',
  },

  // Team Section
  teamSection: {
    backgroundColor: colors.ivory2,
    paddingVertical: spacing.large * 2,
    paddingHorizontal: spacing.medium,
    alignItems: 'center',
  },
  teamMainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.small,
  },
  teamSubtitle: {
    fontSize: 15,
    color: colors.orangeShade8,
    marginBottom: spacing.medium,
  },
  teamDivider: {
    height: 3,
    width: 60,
    backgroundColor: colors.primary,
    marginBottom: spacing.large,
    borderRadius: 2,
  },
  developersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.large,
    width: '100%',
  },
  developerCard: {
    width: windowWidth < 500 ? windowWidth * 0.85 : 200,
    backgroundColor: colors.ivory1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.orangeShade8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  cardGradient: {
    padding: spacing.large,
    alignItems: 'center',
  },
  developerImageWrapper: {
    marginBottom: spacing.medium,
  },
  imageGlow: {
    padding: 4,
    borderRadius: 64,
    backgroundColor: colors.ivory2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  developerImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.orangeShade2,
  },
  developerInfo: {
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  developerName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.orangeShade8,
    marginBottom: spacing.small,
    textAlign: 'center',
  },
  roleBadge: {
    backgroundColor: colors.ivory3,
    paddingHorizontal: spacing.medium,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.orangeShade2,
  },
  developerRole: {
    fontSize: 13,
    color: colors.orangeShade7,
    fontWeight: '600',
  },
  githubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 25,
    gap: 6,
    shadowColor: colors.orangeShade8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  githubText: {
    color: colors.ivory1,
    fontSize: 14,
    fontWeight: '600',
  },

  // Advisor Section
  advisorSection: {
    paddingVertical: spacing.large,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.ivory2,
  },
  advisorMainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.small / 2,
  },
  advisorSubtitle: {
    fontSize: 14,
    color: colors.orangeShade7,
    textAlign: 'center',
    marginBottom: spacing.medium,
  },
  advisorCard: {
    backgroundColor: colors.ivory1,
    borderRadius: 20,
    padding: spacing.large,
    alignItems: 'center',
    shadowColor: colors.orangeShade8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 2,
    borderColor: colors.orangeShade2,
  },
  advisorImageWrapper: {
    marginBottom: spacing.medium,
  },
  advisorImageGlow: {
    padding: 4,
    borderRadius: 75,
    backgroundColor: colors.orangeShade1,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  advisorImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.ivory1,
  },
  advisorInfo: {
    alignItems: 'center',
  },
  advisorName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.orangeShade8,
    marginBottom: spacing.small,
    textAlign: 'center',
  },
  advisorRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.medium,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: spacing.small,
  },
  advisorRoleText: {
    fontSize: 14,
    color: colors.ivory1,
    fontWeight: '600',
  },
  advisorTitle: {
    fontSize: 14,
    color: colors.orangeShade6,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  advisorInstitution: {
    fontSize: 13,
    color: colors.orangeShade7,
    textAlign: 'center',
  },

  // Footer
  footer: {
    paddingVertical: spacing.large * 1.5,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.ivory3,
    marginTop: spacing.large,
  },
  footerContent: {
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.small,
    letterSpacing: 1,
  },
  footerText: {
    fontSize: 14,
    color: colors.orangeShade8,
    marginBottom: 4,
  },
  footerCopyright: {
    fontSize: 12,
    color: colors.orangeShade7,
    marginTop: spacing.small,
  },
});

export default About;
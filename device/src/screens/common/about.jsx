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
import { colors, spacing, globalStyles } from '../../components/common/theme';

const windowWidth = Dimensions.get('window').width;

const About = () => {
  // Mock data for our developers
  const developers = [
    {
      name: "Henrich Lacao",
      image: require("../../../assets/reimu.gif"),
      role: "Developer",
      github: "https://github.com/LacaoProtatooo"
    },
    {
      name: "Donn Anthony Baldoza",
      image: require("../../../assets/marisa.gif"),
      role: "Developer",
      github: "https://github.com/LacaoProtatooo"
    },
    {
      name: "Juliana Mae Ines",
      image: require("../../../assets/marisa.gif"),
      role: "Developer",
      github: "https://github.com/LacaoProtatooo"
    }
  ];

  const openLink = (url) => {
    Linking.openURL(url).catch(err => console.error("Couldn't open link", err));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBackground}>
            <Image 
              source={require("../../../assets/ghost.png")} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Title & Content */}
        <View style={styles.contentWrapper}>
          <Text style={styles.title}>Spirit & Spirits</Text>
          
          <View style={styles.divider} />
          
          <Text style={styles.paragraph}>
            Welcome to Spirit & Spirits, your premier destination for fine wines, premium liquors, and craft spirits.
            We are passionate about bringing you the best selection of beverages from around the world, carefully curated
            to suit every taste and occasion.
          </Text>
          
          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText}>
              "Every bottle tells a story. Every sip creates a memory."
            </Text>
          </View>
          
          <Text style={styles.paragraph}>
            At Spirit & Spirits, we believe in the artistry of fine spirits. Whether you're celebrating a special moment,
            hosting a gathering, or simply enjoying a quiet evening, we are here to help you find the perfect drink to
            elevate your experience.
          </Text>
          
          {/* Features section */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="wine" size={24} color={colors.ivory1} />
              </View>
              <Text style={styles.featureTitle}>Premium Selection</Text>
              <Text style={styles.featureText}>Curated collection of the finest spirits from around the world</Text>
            </View>
            
            <View style={styles.featureItem}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="gift" size={24} color={colors.ivory1} />
              </View>
              <Text style={styles.featureTitle}>Expert Recommendations</Text>
              <Text style={styles.featureText}>Personalized suggestions based on your taste preferences</Text>
            </View>
            
            <View style={styles.featureItem}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="home" size={24} color={colors.ivory1} />
              </View>
              <Text style={styles.featureTitle}>Home Delivery</Text>
              <Text style={styles.featureText}>Quick and secure delivery right to your doorstep</Text>
            </View>
          </View>
          
          <Text style={styles.paragraph}>
            Our knowledgeable team is dedicated to providing exceptional service and sharing their expertise to guide you
            through our extensive collection. From rare vintages to local favorites, we take pride in offering something
            for everyone.
          </Text>
          
          <Text style={styles.paragraph}>
            Thank you for choosing Spirit & Spirits. Cheers to great moments and unforgettable memories!
          </Text>
        </View>
        
        {/* Meet the Team Section */}
        <View style={styles.teamSection}>
          <Text style={styles.teamTitle}>Meet Our Team</Text>
          <View style={styles.teamDivider} />
          
          <View style={styles.developersContainer}>
            {developers.map((developer, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.developerCard}
                onPress={() => openLink(developer.github)}
              >
                <View style={styles.developerImageContainer}>
                  <Image source={developer.image} style={styles.developerImage} />
                </View>
                <Text style={styles.developerName}>{developer.name}</Text>
                <Text style={styles.developerRole}>{developer.role}</Text>
                <View style={styles.githubButton}>
                  <Ionicons name="logo-github" size={16} color={colors.ivory1} />
                  <Text style={styles.githubText}>GitHub</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© {new Date().getFullYear()} Spirit & Spirits</Text>
          <Text style={styles.footerText}>All rights reserved</Text>
          
          <View style={styles.socialContainer}>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-facebook" size={20} color={colors.bronzeShade3} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-instagram" size={20} color={colors.bronzeShade3} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-twitter" size={20} color={colors.bronzeShade3} />
            </TouchableOpacity>
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
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingBottom: 40,
  },
  logoContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.large,
    marginBottom: spacing.large,
  },
  logoBackground: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.bronzeShade8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    width: 270,
    height: 270,
  },
  contentWrapper: {
    width: '90%',
    maxWidth: 700,
    paddingHorizontal: spacing.medium,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: spacing.small,
    textAlign: 'center',
    color: colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  divider: {
    height: 2,
    width: 60,
    backgroundColor: colors.bronzeShade3,
    alignSelf: 'center',
    marginBottom: spacing.large,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 26,
    marginBottom: spacing.medium,
    color: colors.text,
    textAlign: 'center',
  },
  quoteContainer: {
    backgroundColor: colors.ivory4,
    borderLeftWidth: 4,
    borderLeftColor: colors.bronzeShade3,
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.large,
    marginVertical: spacing.large,
    borderRadius: 8,
  },
  quoteText: {
    fontSize: 18,
    fontStyle: 'italic',
    color: colors.bronzeShade5,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginVertical: spacing.large,
  },
  featureItem: {
    width: windowWidth < 600 ? '100%' : '30%',
    alignItems: 'center',
    marginBottom: spacing.large,
    paddingHorizontal: spacing.small,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bronzeShade3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.small,
    shadowColor: colors.bronzeShade8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.bronzeShade5,
    marginBottom: 8,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  teamSection: {
    width: '100%',
    backgroundColor: colors.ivory3,
    paddingVertical: spacing.large * 2,
    marginTop: spacing.large,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.bronzeShade2 + '40',
  },
  teamTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.bronzeShade5,
    textAlign: 'center',
    marginBottom: spacing.small,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  teamDivider: {
    height: 2,
    width: 40,
    backgroundColor: colors.bronzeShade3,
    marginBottom: spacing.large * 1.5,
  },
  developersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '90%',
    maxWidth: 700,
  },
  developerCard: {
    width: windowWidth < 500 ? '80%' : 180,
    backgroundColor: colors.ivory1,
    borderRadius: 12,
    padding: spacing.medium,
    alignItems: 'center',
    margin: spacing.medium,
    shadowColor: colors.bronzeShade8,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.bronzeShade2 + '30',
  },
  developerImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: spacing.medium,
    borderWidth: 3,
    borderColor: colors.bronzeShade3,
  },
  developerImage: {
    width: '100%',
    height: '100%',
  },
  developerName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.bronzeShade6,
    marginBottom: 4,
    textAlign: 'center',
  },
  developerRole: {
    fontSize: 14,
    color: colors.bronzeShade4,
    marginBottom: spacing.medium,
    textAlign: 'center',
  },
  githubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bronzeShade5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  githubText: {
    color: colors.ivory1,
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    width: '100%',
    paddingVertical: spacing.large,
    alignItems: 'center',
    marginTop: spacing.large,
    borderTopWidth: 1,
    borderTopColor: colors.bronzeShade2 + '20',
  },
  footerText: {
    fontSize: 12,
    color: colors.bronzeShade5,
    marginBottom: 4,
  },
  socialContainer: {
    flexDirection: 'row',
    marginTop: spacing.medium,
  },
  socialButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ivory4,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.bronzeShade3 + '30',
  },
});

export default About;
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, globalStyles } from '../../components/common/theme';

const windowWidth = Dimensions.get('window').width;

// Rules and Regulations Data
const rulesData = {
  intro: {
    title: "WEBTTODA RULES AND REGULATIONS",
    description: "The following infraction and their corresponding penalties are prescribed to maintain the members highest work efficiency, smooth and successful operation of the association and help the WEBTTODA contribute its effectiveness in our community.",
    note: "The officers and trustees believes that the list of infraction and offenses constitutes just cause for disciplinary action and corresponding penalties imposed range from warning and reprimand to suspension and dismissal.",
  },
  sections: [
    {
      id: 1,
      title: "I. WORK AND DRIVE EFFICIENCY",
      icon: "car-sport",
      color: colors.orangeShade4,
      rules: [
        {
          number: 1,
          offense: "Any act of insubordination",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 2,
          offense: "Illegal lining other than prescribed point",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 3,
          offense: "Illegal pick-up of passengers",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 4,
          offense: "Wearing sandos, short pants and sandals from Monday to Friday (except during rainy days when declared by the President)",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 5,
          offense: "Wearing sandos during Saturday, Sunday and Holiday",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 6,
          offense: "Wearing slippers and short pants during weekdays",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
      ]
    },
    {
      id: 2,
      title: "II. ACT OF DISHONESTY",
      icon: "alert-circle",
      color: colors.orangeShade6,
      rules: [
        {
          number: 7,
          offense: "Failure and/or refusing to pay the daily dues",
          penalties: ["Suspension 1 day", "Suspension 3 days", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 8,
          offense: "FALSE STATEMENT – Any applicant who had been accepted for membership and later found out to have fraudulent entries in order to 'influence' approval",
          penalties: ["Dismissal"]
        },
      ]
    },
    {
      id: 3,
      title: "III. ACT AGAINST PUBLIC POLICY",
      icon: "warning",
      color: colors.orangeShade2,
      rules: [
        {
          number: 9,
          offense: "Driving under the influence of liquor, drug and/or participating in any drinking spree within the WEBTTODA premises or any form of illegal gambling within the route",
          penalties: ["Suspension 1 week", "Dismissal"]
        },
        {
          number: 10,
          offense: "Defacing and/or tearing down posters of the association from bulletin board, or adding insulting words and/or pictures or marks",
          penalties: ["Suspension 1 week", "Suspension 1 month", "Dismissal"]
        },
        {
          number: 11,
          offense: "Fighting in the association regardless of the cause",
          penalties: ["Suspension 1 week", "Dismissal"]
        },
        {
          number: 12,
          offense: "Attacking another member without any provocation causing bodily harm and/or injury",
          penalties: ["Suspension 1 week", "Dismissal"]
        },
        {
          number: 13,
          offense: "Challenging any member to fight",
          penalties: ["Suspension 2 weeks", "Dismissal"]
        },
        {
          number: 14,
          offense: "Challenging Officers and Trustees",
          penalties: ["Suspension 2 weeks or dismissal", "Dismissal"]
        },
        {
          number: 15,
          offense: "Discourteous acts committed against passengers within the association playing route area",
          penalties: ["Suspension 3 days", "Suspension 1 week", "Dismissal"]
        },
        {
          number: 16,
          offense: "Reckless driving within the WEBTTODA playing routes",
          penalties: ["Suspension 1 week or dismissal", "Suspension 1 week"]
        },
        {
          number: 17,
          offense: "Cause ill-will and dissension or create cliques and/or intrigues among the officers, trustees and members",
          penalties: ["Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"]
        },
        {
          number: 18,
          offense: "Treating, coercing and intimidating below members",
          penalties: ["Suspension 1 week", "Suspension 1 month", "Dismissal"]
        },
      ]
    },
    {
      id: 4,
      title: "IV. SERIOUS OFFENSES",
      icon: "ban",
      color: "#DC2626",
      rules: [
        {
          number: 19,
          offense: "Conviction of any crime where the penalty is for one (1) month or more",
          penalties: ["Dismissal"]
        },
        {
          number: 20,
          offense: "Making malicious false accusation and statement concerning the good name of the association",
          penalties: ["Dismissal"]
        },
        {
          number: 21,
          offense: "Substituting old parts for operators owned property and appropriating same",
          penalties: ["Dismissal"]
        },
        {
          number: 22,
          offense: "Misusing, destroying, defacing and/or damaging association property",
          penalties: ["Suspension 1 week or Dismissal"]
        },
        {
          number: 23,
          offense: "Acts of disrespect or discourtesy to the association executive",
          penalties: ["Suspension 1 month", "Dismissal"]
        },
        {
          number: 24,
          offense: "Insulting and/or unbecoming conduct and/or language to the association officers and trustees",
          penalties: ["Suspension 2 weeks", "Dismissal"]
        },
        {
          number: 25,
          offense: "Disobedience to lawful orders of Marshall",
          penalties: ["Suspension 2 weeks or dismissal", "Dismissal"]
        },
        {
          number: 26,
          offense: "Failure to attend the general meeting during the designated time and place especially drivers without valid reason",
          penalties: ["Suspension 1 day", "Suspension 3 days", "Dismissal"]
        },
        {
          number: 27,
          offense: "Failure to observe personal cleanliness, uncouth clothings",
          penalties: ["Warning", "Suspension 3 days", "Suspension 1 week", "Dismissal"]
        },
      ]
    },
    {
      id: 5,
      title: "V. REPEATED VIOLATIONS",
      icon: "repeat",
      color: "#7C3AED",
      rules: [
        {
          number: 28,
          offense: "Three warnings within a period of one (1) year last violation",
          penalties: ["Suspension 1 week"]
        },
        {
          number: 29,
          offense: "Three suspensions within a period of one (1) year last violation",
          penalties: ["Dismissal"]
        },
        {
          number: 30,
          offense: "If the offense only calls for a lighter penalty such as warning and/or suspension, but the offense itself results in serious and/or total injury to anyone, management shall order the immediate dismissal of the erring members.",
          penalties: ["Immediate Dismissal"]
        },
      ]
    },
    {
      id: 6,
      title: "VI. MEMBERSHIP/DISMEMBERSHIP",
      icon: "people",
      color: "#059669",
      rules: [
        {
          number: 31,
          offense: "Operators with tricycle unit and active drivers are the bona fide members of the WEBTTODA Association.",
          penalties: []
        },
        {
          number: 32,
          offense: "Operators as non-drivers after waiving the rights to operate within the WEBTTODA line or sold his/her tricycle unit to anybody will be automatically dismembered/termination of benefits with the association.",
          penalties: []
        },
        {
          number: 33,
          offense: "Operators as drivers after waiving the rights to operate or sold their units to others will maintain membership as driver, provided that he will drive once within a period of three (3) months.",
          penalties: []
        },
        {
          number: 34,
          offense: "Active driver will maintain membership provided that he will drive once within a period of three (3) months within the WEBTTODA line.",
          penalties: []
        },
        {
          number: 35,
          offense: "Dismembered or terminated driver who re-applies for membership shall accomplish the requirement as a new applicant and shall pay the membership fee amounting to 50% of the current driver's membership fee.",
          penalties: []
        },
        {
          number: 36,
          offense: "Transfer of rights for non-members is ₱10,000, whereas a current member is ₱3,000.",
          penalties: []
        },
        {
          number: 37,
          offense: "Old member facilitating the sale of tricycle unit without the knowledge of the association to evade membership fee of the new owner is subject to board hearing and general member for dismissal.",
          penalties: []
        },
      ]
    },
  ]
};

const RulesRegulationsScreen = ({ navigation }) => {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const renderPenaltyBadge = (penalty, index) => {
    const isWarning = penalty.toLowerCase().includes('warning');
    const isDismissal = penalty.toLowerCase().includes('dismissal');
    const isSuspension = penalty.toLowerCase().includes('suspension');

    let bgColor = colors.ivory3;
    let textColor = colors.orangeShade8;
    let iconName = 'alert-circle';

    if (isDismissal) {
      bgColor = '#FEE2E2';
      textColor = '#DC2626';
      iconName = 'close-circle';
    } else if (isSuspension) {
      bgColor = '#FEF3C7';
      textColor = '#D97706';
      iconName = 'time';
    } else if (isWarning) {
      bgColor = '#DBEAFE';
      textColor = '#2563EB';
      iconName = 'warning';
    }

    return (
      <View key={index} style={[styles.penaltyBadge, { backgroundColor: bgColor }]}>
        <Ionicons name={iconName} size={14} color={textColor} style={styles.penaltyIcon} />
        <Text style={[styles.penaltyText, { color: textColor }]}>
          {index + 1}{getOrdinalSuffix(index + 1)} Offense: {penalty}
        </Text>
      </View>
    );
  };

  const getOrdinalSuffix = (num) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={[colors.primary, colors.orangeShade6]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation?.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.ivory1} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rules & Regulations</Text>
        <View style={styles.headerRight}>
          <Ionicons name="document-text" size={22} color={colors.ivory1} />
        </View>
      </LinearGradient>

      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction Card with Gradient Border */}
        <View style={styles.introCardWrapper}>
          <LinearGradient
            colors={[colors.primary, colors.orangeShade5, colors.orangeShade7]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.introGradientBorder}
          >
            <View style={styles.introCard}>
              <View style={styles.introIconContainer}>
                <LinearGradient
                  colors={[colors.primary, colors.orangeShade6]}
                  style={styles.introIconGradient}
                >
                  <Ionicons name="shield-checkmark" size={32} color={colors.ivory1} />
                </LinearGradient>
              </View>
              <Text style={styles.introTitle}>{rulesData.intro.title}</Text>
              <View style={styles.divider} />
              <Text style={styles.introDescription}>{rulesData.intro.description}</Text>
              <View style={styles.noteContainer}>
                <View style={styles.noteIconWrapper}>
                  <Ionicons name="information-circle" size={20} color={colors.primary} />
                </View>
                <Text style={styles.noteText}>{rulesData.intro.note}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>6</Text>
            <Text style={styles.statLabel}>Sections</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>37</Text>
            <Text style={styles.statLabel}>Rules</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>2004</Text>
            <Text style={styles.statLabel}>Established</Text>
          </View>
        </View>

        {/* Sections */}
        {rulesData.sections.map((section) => (
          <View key={section.id} style={styles.sectionContainer}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section.id)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[section.color, adjustColor(section.color, -30)]}
                style={styles.sectionIconContainer}
              >
                <Ionicons name={section.icon} size={22} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionCount}>{section.rules.length} rules</Text>
              </View>
              <View style={[styles.expandIcon, { backgroundColor: expandedSection === section.id ? colors.primary + '20' : colors.ivory3 }]}>
                <Ionicons 
                  name={expandedSection === section.id ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={expandedSection === section.id ? colors.primary : colors.orangeShade6} 
                />
              </View>
            </TouchableOpacity>

            {expandedSection === section.id && (
              <View style={styles.rulesContainer}>
                {section.rules.map((rule, index) => (
                  <View key={rule.number} style={[styles.ruleCard, index === section.rules.length - 1 && { marginBottom: 0 }]}>
                    <View style={styles.ruleHeader}>
                      <LinearGradient
                        colors={[section.color, adjustColor(section.color, -20)]}
                        style={styles.ruleNumberBadge}
                      >
                        <Text style={styles.ruleNumber}>{rule.number}</Text>
                      </LinearGradient>
                      <Text style={styles.ruleOffense}>{rule.offense}</Text>
                    </View>
                    {rule.penalties.length > 0 && (
                      <View style={styles.penaltiesContainer}>
                        <View style={styles.penaltiesHeader}>
                          <Ionicons name="warning-outline" size={14} color={colors.orangeShade6} />
                          <Text style={styles.penaltiesLabel}>Penalties</Text>
                        </View>
                        {rule.penalties.map((penalty, pIndex) => renderPenaltyBadge(penalty, pIndex))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Footer with Signature */}
        <LinearGradient
          colors={[colors.ivory4, colors.ivory2]}
          style={styles.footer}
        >
          <View style={styles.footerBadge}>
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          </View>
          <Text style={styles.footerTitle}>APPROVED FOR DISSEMINATION</Text>
          <View style={styles.signatureContainer}>
            <Text style={styles.footerText}>ERNESTO B. OCCIANO</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.footerSubtext}>President, WEBTTODA</Text>
          </View>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={14} color={colors.orangeShade5} />
            <Text style={styles.footerDate}>July 21, 2004</Text>
          </View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper function to darken/lighten colors
const adjustColor = (color, amount) => {
  const clamp = (num) => Math.min(255, Math.max(0, num));
  const hex = color.replace('#', '');
  const r = clamp(parseInt(hex.substring(0, 2), 16) + amount);
  const g = clamp(parseInt(hex.substring(2, 4), 16) + amount);
  const b = clamp(parseInt(hex.substring(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    elevation: 4,
    shadowColor: colors.orangeShade8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ivory1,
    letterSpacing: 0.5,
  },
  headerRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: spacing.medium,
    paddingBottom: spacing.large * 2,
  },
  introCardWrapper: {
    marginBottom: spacing.medium,
  },
  introGradientBorder: {
    borderRadius: 20,
    padding: 2,
  },
  introCard: {
    backgroundColor: colors.ivory1,
    borderRadius: 18,
    padding: spacing.large,
    alignItems: 'center',
  },
  introIconContainer: {
    marginBottom: spacing.medium,
  },
  introIconGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.orangeShade8,
    textAlign: 'center',
    marginBottom: spacing.small,
    letterSpacing: 0.5,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginBottom: spacing.medium,
  },
  introDescription: {
    fontSize: 14,
    color: colors.orangeShade7,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.medium,
  },
  noteContainer: {
    flexDirection: 'row',
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  noteIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: colors.orangeShade6,
    lineHeight: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.orangeShade6,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.ivory3,
  },
  sectionContainer: {
    marginBottom: spacing.medium,
    backgroundColor: colors.ivory1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.orangeShade8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.medium,
    backgroundColor: colors.ivory1,
  },
  sectionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.medium,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.orangeShade8,
  },
  sectionCount: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginTop: 2,
  },
  expandIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rulesContainer: {
    padding: spacing.medium,
    paddingTop: 0,
    backgroundColor: colors.ivory2 + '50',
  },
  ruleCard: {
    backgroundColor: colors.ivory1,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.small,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ruleNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small,
  },
  ruleNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ruleOffense: {
    flex: 1,
    fontSize: 13,
    color: colors.orangeShade7,
    lineHeight: 20,
  },
  penaltiesContainer: {
    marginTop: spacing.medium,
    marginLeft: 40,
    backgroundColor: colors.ivory4,
    borderRadius: 10,
    padding: spacing.small,
  },
  penaltiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  penaltiesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.orangeShade6,
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  penaltyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.small,
    borderRadius: 8,
    marginBottom: 6,
  },
  penaltyIcon: {
    marginRight: 6,
  },
  penaltyText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    marginTop: spacing.medium,
    alignItems: 'center',
    paddingVertical: spacing.large,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  footerBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  footerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.orangeShade6,
    letterSpacing: 1,
    marginBottom: spacing.medium,
  },
  signatureContainer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.orangeShade8,
  },
  signatureLine: {
    width: 150,
    height: 1,
    backgroundColor: colors.orangeShade5,
    marginVertical: spacing.small,
  },
  footerSubtext: {
    fontSize: 13,
    color: colors.orangeShade6,
    fontStyle: 'italic',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.medium,
    backgroundColor: colors.ivory1,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: 20,
  },
  footerDate: {
    fontSize: 12,
    color: colors.orangeShade5,
    marginLeft: 6,
    fontWeight: '600',
  },
});

export default RulesRegulationsScreen;

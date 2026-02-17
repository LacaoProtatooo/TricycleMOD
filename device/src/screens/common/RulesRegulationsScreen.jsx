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

// ====== ENGLISH Rules and Regulations Data ======
const rulesDataEN = {
  intro: {
    title: "WEBTTODA RULES AND REGULATIONS",
    description: "The following infraction and their corresponding penalties are prescribed to maintain the members highest work efficiency, smooth and successful operation of the association and help the WEBTTODA contribute its effectiveness in our community.",
    note: "The officers and trustees believes that the list of infraction and offenses constitutes just cause for disciplinary action and corresponding penalties imposed range from warning and reprimand to suspension and dismissal.",
  },
  labels: {
    headerTitle: "Rules & Regulations",
    sections: "Sections",
    rules: "Rules",
    established: "Established",
    penalties: "Penalties",
    rulesCount: "rules",
    approvedFor: "APPROVED FOR DISSEMINATION",
    offensePrefix: "Offense",
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
          offense: "Transfer of rights for non-members is \u20B110,000, whereas a current member is \u20B13,000.",
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

// ====== TAGALOG (Filipino) Rules and Regulations Data ======
const rulesDataTL = {
  intro: {
    title: "MGA PATAKARAN AT REGULASYON NG WEBTTODA",
    description: "Ang mga sumusunod na paglabag at kaukulang parusa ay itinakda upang mapanatili ang pinakamataas na kahusayan sa trabaho ng mga miyembro, maayos at matagumpay na operasyon ng samahan at matulungan ang WEBTTODA na makapag-ambag ng epektibong serbisyo sa ating komunidad.",
    note: "Ang mga opisyal at trustees ay naniniwala na ang listahan ng mga paglabag at pagkakasala ay sapat na dahilan para sa aksyong pandisiplina at ang kaukulang parusa ay mula sa babala at pagsaway hanggang sa suspensyon at pagtitiwalag.",
  },
  labels: {
    headerTitle: "Mga Patakaran",
    sections: "Seksyon",
    rules: "Patakaran",
    established: "Itinatag",
    penalties: "Mga Parusa",
    rulesCount: "patakaran",
    approvedFor: "PINAGTIBAY PARA SA PAGPAPAKALAT",
    offensePrefix: "Pagkakasala",
  },
  sections: [
    {
      id: 1,
      title: "I. KAHUSAYAN SA TRABAHO AT PAGMAMANEHO",
      icon: "car-sport",
      color: colors.orangeShade4,
      rules: [
        {
          number: 1,
          offense: "Anumang gawa ng pagsuway (insubordination)",
          penalties: ["Suspensyon 3 araw", "Suspensyon 1 linggo", "Suspensyon 1 buwan o pagtitiwalag", "Pagtitiwalag"]
        },
        {
          number: 2,
          offense: "Iligal na pagpila maliban sa itinalagang punto",
          penalties: ["Suspensyon 3 araw", "Suspensyon 1 linggo", "Suspensyon 1 buwan o pagtitiwalag", "Pagtitiwalag"]
        },
        {
          number: 3,
          offense: "Iligal na pagsakay ng mga pasahero",
          penalties: ["Suspensyon 3 araw", "Suspensyon 1 linggo", "Suspensyon 1 buwan o pagtitiwalag", "Pagtitiwalag"]
        },
        {
          number: 4,
          offense: "Pagsusuot ng sando, short pants at tsinelas mula Lunes hanggang Biyernes (maliban kung umuulan na idineklara ng Pangulo)",
          penalties: ["Suspensyon 3 araw", "Suspensyon 1 linggo", "Suspensyon 1 buwan o pagtitiwalag", "Pagtitiwalag"]
        },
        {
          number: 5,
          offense: "Pagsusuot ng sando tuwing Sabado, Linggo at Holiday",
          penalties: ["Suspensyon 3 araw", "Suspensyon 1 linggo", "Suspensyon 1 buwan o pagtitiwalag", "Pagtitiwalag"]
        },
        {
          number: 6,
          offense: "Pagsusuot ng tsinelas at short pants tuwing weekdays",
          penalties: ["Suspensyon 3 araw", "Suspensyon 1 linggo", "Suspensyon 1 buwan o pagtitiwalag", "Pagtitiwalag"]
        },
      ]
    },
    {
      id: 2,
      title: "II. GAWA NG KAWALANG-KATAPATAN",
      icon: "alert-circle",
      color: colors.orangeShade6,
      rules: [
        {
          number: 7,
          offense: "Pagkabigo at/o pagtanggi na magbayad ng araw-araw na dues",
          penalties: ["Suspensyon 1 araw", "Suspensyon 3 araw", "Suspensyon 1 buwan o pagtitiwalag", "Pagtitiwalag"]
        },
        {
          number: 8,
          offense: "MALING PAHAYAG – Sinumang aplikante na tinanggap bilang miyembro at kalaunan ay natuklasang may mapanlinlang na mga entry upang 'maimpluwensyahan' ang pag-apruba",
          penalties: ["Pagtitiwalag"]
        },
      ]
    },
    {
      id: 3,
      title: "III. GAWA LABAN SA PAMPUBLIKONG PATAKARAN",
      icon: "warning",
      color: colors.orangeShade2,
      rules: [
        {
          number: 9,
          offense: "Pagmamaneho sa ilalim ng impluwensya ng alak, droga at/o pagsali sa anumang inuman sa loob ng WEBTTODA premises o anumang uri ng iligal na sugal sa ruta",
          penalties: ["Suspensyon 1 linggo", "Pagtitiwalag"]
        },
        {
          number: 10,
          offense: "Pagpunit at/o pagbura ng mga poster ng samahan mula sa bulletin board, o pagdagdag ng nakakainsultong salita at/o larawan o marka",
          penalties: ["Suspensyon 1 linggo", "Suspensyon 1 buwan", "Pagtitiwalag"]
        },
        {
          number: 11,
          offense: "Pag-aaway sa loob ng samahan anuman ang dahilan",
          penalties: ["Suspensyon 1 linggo", "Pagtitiwalag"]
        },
        {
          number: 12,
          offense: "Pag-atake sa kapwa miyembro nang walang probokasyon na nagdudulot ng pinsala sa katawan",
          penalties: ["Suspensyon 1 linggo", "Pagtitiwalag"]
        },
        {
          number: 13,
          offense: "Paghamon sa sinumang miyembro na makipag-away",
          penalties: ["Suspensyon 2 linggo", "Pagtitiwalag"]
        },
        {
          number: 14,
          offense: "Paghamon sa mga Opisyal at Trustees",
          penalties: ["Suspensyon 2 linggo o pagtitiwalag", "Pagtitiwalag"]
        },
        {
          number: 15,
          offense: "Bastos na gawa laban sa mga pasahero sa loob ng ruta ng samahan",
          penalties: ["Suspensyon 3 araw", "Suspensyon 1 linggo", "Pagtitiwalag"]
        },
        {
          number: 16,
          offense: "Pabaya/mapusok na pagmamaneho sa loob ng mga ruta ng WEBTTODA",
          penalties: ["Suspensyon 1 linggo o pagtitiwalag", "Suspensyon 1 linggo"]
        },
        {
          number: 17,
          offense: "Pagdudulot ng sama ng loob at pagkakahati-hati o paggawa ng mga grupo at/o intriga sa mga opisyal, trustees at miyembro",
          penalties: ["Suspensyon 1 linggo", "Suspensyon 1 buwan o pagtitiwalag", "Pagtitiwalag"]
        },
        {
          number: 18,
          offense: "Pagbabanta, pamimilit at intimidasyon sa mga miyembro",
          penalties: ["Suspensyon 1 linggo", "Suspensyon 1 buwan", "Pagtitiwalag"]
        },
      ]
    },
    {
      id: 4,
      title: "IV. MABIBIGAT NA PAGKAKASALA",
      icon: "ban",
      color: "#DC2626",
      rules: [
        {
          number: 19,
          offense: "Pagkahatol sa anumang krimen kung saan ang parusa ay isang (1) buwan o higit pa",
          penalties: ["Pagtitiwalag"]
        },
        {
          number: 20,
          offense: "Paggawa ng malisyosong maling paratang at pahayag tungkol sa magandang pangalan ng samahan",
          penalties: ["Pagtitiwalag"]
        },
        {
          number: 21,
          offense: "Pagpapalit ng mga lumang parte para sa pag-aari ng operator at pag-angkin nito",
          penalties: ["Pagtitiwalag"]
        },
        {
          number: 22,
          offense: "Maling paggamit, pagwasak, pagpunit at/o pagkasira ng ari-arian ng samahan",
          penalties: ["Suspensyon 1 linggo o Pagtitiwalag"]
        },
        {
          number: 23,
          offense: "Gawa ng kawalang-galang o kabastusan sa mga executive ng samahan",
          penalties: ["Suspensyon 1 buwan", "Pagtitiwalag"]
        },
        {
          number: 24,
          offense: "Pang-iinsulto at/o hindi naaangkop na pag-uugali at/o pananalita sa mga opisyal at trustees ng samahan",
          penalties: ["Suspensyon 2 linggo", "Pagtitiwalag"]
        },
        {
          number: 25,
          offense: "Pagsuway sa mga legal na utos ng Marshall",
          penalties: ["Suspensyon 2 linggo o pagtitiwalag", "Pagtitiwalag"]
        },
        {
          number: 26,
          offense: "Pagkabigong dumalo sa pangkalahatang pulong sa itinakdang oras at lugar lalo na ang mga driver na walang makatwirang dahilan",
          penalties: ["Suspensyon 1 araw", "Suspensyon 3 araw", "Pagtitiwalag"]
        },
        {
          number: 27,
          offense: "Pagkabigong magpanatili ng personal na kalinisan, hindi naaangkop na pananamit",
          penalties: ["Babala", "Suspensyon 3 araw", "Suspensyon 1 linggo", "Pagtitiwalag"]
        },
      ]
    },
    {
      id: 5,
      title: "V. PAULIT-ULIT NA PAGLABAG",
      icon: "repeat",
      color: "#7C3AED",
      rules: [
        {
          number: 28,
          offense: "Tatlong babala sa loob ng isang (1) taon mula sa huling paglabag",
          penalties: ["Suspensyon 1 linggo"]
        },
        {
          number: 29,
          offense: "Tatlong suspensyon sa loob ng isang (1) taon mula sa huling paglabag",
          penalties: ["Pagtitiwalag"]
        },
        {
          number: 30,
          offense: "Kung ang pagkakasala ay nangangailangan lamang ng magaan na parusa tulad ng babala at/o suspensyon, ngunit ang pagkakasala mismo ay nagresulta sa malubha at/o kabuuang pinsala sa sinuman, ang pamunuan ay mag-uutos ng agarang pagtitiwalag ng nagkasalang miyembro.",
          penalties: ["Agarang Pagtitiwalag"]
        },
      ]
    },
    {
      id: 6,
      title: "VI. PAGIGING MIYEMBRO / PAGKAALIS SA SAMAHAN",
      icon: "people",
      color: "#059669",
      rules: [
        {
          number: 31,
          offense: "Ang mga operator na may tricycle unit at mga aktibong driver ay ang mga tunay na miyembro ng WEBTTODA Association.",
          penalties: []
        },
        {
          number: 32,
          offense: "Ang mga operator bilang hindi driver na nagsuko ng karapatan na mag-operate sa WEBTTODA line o nagbenta ng kanilang tricycle unit ay awtomatikong tatanggalin sa samahan.",
          penalties: []
        },
        {
          number: 33,
          offense: "Ang mga operator bilang driver na nagsuko ng karapatan o nagbenta ng kanilang mga unit ay mananatiling miyembro bilang driver, basta't siya ay magmamaneho kahit isang beses sa loob ng tatlong (3) buwan.",
          penalties: []
        },
        {
          number: 34,
          offense: "Ang aktibong driver ay mananatiling miyembro basta't siya ay magmamaneho kahit isang beses sa loob ng tatlong (3) buwan sa WEBTTODA line.",
          penalties: []
        },
        {
          number: 35,
          offense: "Ang dating miyembrong tinanggal na nag-apply muli ay kailangang kumpletuhin ang mga rekwayrment bilang bagong aplikante at magbayad ng membership fee na 50% ng kasalukuyang membership fee ng driver.",
          penalties: []
        },
        {
          number: 36,
          offense: "Ang transfer of rights para sa hindi miyembro ay \u20B110,000, samantalang para sa kasalukuyang miyembro ay \u20B13,000.",
          penalties: []
        },
        {
          number: 37,
          offense: "Ang lumang miyembro na nagpapadali ng pagbebenta ng tricycle unit nang walang kaalaman ng samahan upang makaiwas sa membership fee ng bagong may-ari ay sasailalim sa board hearing at pangkalahatang miyembro para sa pagtitiwalag.",
          penalties: []
        },
      ]
    },
  ]
};

const RulesRegulationsScreen = ({ navigation }) => {
  const [expandedSection, setExpandedSection] = useState(null);
  const [language, setLanguage] = useState('tl'); // 'tl' = Tagalog (default), 'en' = English

  const rulesData = language === 'tl' ? rulesDataTL : rulesDataEN;

  const toggleSection = (sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const renderPenaltyBadge = (penalty, index) => {
    const isWarning = penalty.toLowerCase().includes('warning') || penalty.toLowerCase().includes('babala');
    const isDismissal = penalty.toLowerCase().includes('dismissal') || penalty.toLowerCase().includes('pagtitiwalag');
    const isSuspension = penalty.toLowerCase().includes('suspension') || penalty.toLowerCase().includes('suspensyon');

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
          {index + 1}{getOrdinalSuffix(index + 1)} {rulesData.labels.offensePrefix}: {penalty}
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
        <Text style={styles.headerTitle}>{rulesData.labels.headerTitle}</Text>
        <TouchableOpacity
          style={styles.langToggleButton}
          onPress={() => setLanguage(language === 'tl' ? 'en' : 'tl')}
          activeOpacity={0.7}
        >
          <Ionicons name="language" size={16} color={colors.ivory1} style={{ marginRight: 4 }} />
          <Text style={styles.langToggleText}>{language === 'tl' ? 'EN' : 'TL'}</Text>
        </TouchableOpacity>
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
            <Text style={styles.statLabel}>{rulesData.labels.sections}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>37</Text>
            <Text style={styles.statLabel}>{rulesData.labels.rules}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>2004</Text>
            <Text style={styles.statLabel}>{rulesData.labels.established}</Text>
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
                <Text style={styles.sectionCount}>{section.rules.length} {rulesData.labels.rulesCount}</Text>
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
                          <Text style={styles.penaltiesLabel}>{rulesData.labels.penalties}</Text>
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
          <Text style={styles.footerTitle}>{rulesData.labels.approvedFor}</Text>
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
  langToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  langToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ivory1,
    letterSpacing: 0.5,
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

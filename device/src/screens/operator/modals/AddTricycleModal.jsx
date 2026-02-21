import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  Alert,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../../../components/common/theme';
import styles from '../operatorStyles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MOTORCYCLE_MODELS = [
  {
    brand: 'Honda',
    models: [
      'TMX 125 Alpha',
      'TMX 155',
      'TMX Supremo',
      'XRM 110 / 125',
      'Wave 110 / 125',
    ],
  },
  {
    brand: 'Yamaha',
    models: [
      'YTX 125',
      'YTX 125 DX',
      'SZ 150',
      'Sight',
      'Vega',
    ],
  },
  {
    brand: 'Suzuki',
    models: [
      'GD 110',
      'GD 115',
      'Raider J 115',
      'Smash 110 / 115',
    ],
  },
  {
    brand: 'Kawasaki',
    models: [
      'Barako II 175',
      'Barako 175',
      'CT 125',
    ],
  },
  {
    brand: 'Rusi',
    models: [
      'Rusi 125',
      'Rusi 150',
      'Rusi Classic 250',
    ],
  },
];

// Days of the week for coding day selection
const CODING_DAYS = [
  { value: null, label: 'No Coding Day' },
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// Helper function to get day name from number
const getDayName = (dayNumber) => {
  const day = CODING_DAYS.find(d => d.value === dayNumber);
  return day ? day.label : 'No Coding Day';
};

// Helper function to create form data for image upload
const createImageFormData = (uri, fieldName = 'image') => {
  const formData = new FormData();
  const filename = uri.split('/').pop();
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';
  
  formData.append(fieldName, {
    uri,
    name: filename,
    type,
  });
  
  return formData;
};

export default function AddTricycleModal({
  visible,
  onClose,
  onSubmit,
  newTricycle,
  setNewTricycle,
  creating,
  token,
  BACKEND
}) {
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [showCodingDayPicker, setShowCodingDayPicker] = useState(false);
  
  // Document scanning states
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'documents'
  const [crImage, setCrImage] = useState(null);
  const [orImage, setOrImage] = useState(null);
  const [scanningCR, setScanningCR] = useState(false);
  const [scanningOR, setScanningOR] = useState(false);
  const [crData, setCrData] = useState(null);
  const [orData, setOrData] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [showCRDetails, setShowCRDetails] = useState(false);
  const [showORDetails, setShowORDetails] = useState(false);
  const [showImageSourceModal, setShowImageSourceModal] = useState(null); // 'cr' | 'or' | null
  const [crExpanded, setCrExpanded] = useState(false);
  const [orExpanded, setOrExpanded] = useState(false);
  
  // Animated values for scan pulse
  const crScanAnim = useRef(new Animated.Value(0)).current;
  const orScanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (scanningCR) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(crScanAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(crScanAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      crScanAnim.setValue(0);
    }
  }, [scanningCR]);

  useEffect(() => {
    if (scanningOR) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(orScanAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(orScanAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      orScanAnim.setValue(0);
    }
  }, [scanningOR]);

  const handleModelSelect = (brand, model) => {
    setNewTricycle({ ...newTricycle, model: `${brand} ${model}` });
    setShowModelPicker(false);
  };

  const handleOtherModelSubmit = () => {
    if (customModel.trim()) {
      setNewTricycle({ ...newTricycle, model: customModel.trim() });
      setShowModelPicker(false);
      setShowOtherInput(false);
      setCustomModel('');
    }
  };

  // Image picker functions
  const pickImage = async (type) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is needed.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result?.canceled === true) return;
      const uri = result?.assets?.[0]?.uri || result?.uri;

      if (!uri) return;

      if (type === 'cr') {
        setCrImage(uri);
        setCrData(null);
        setValidationResult(null);
      } else {
        setOrImage(uri);
        setOrData(null);
        setValidationResult(null);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async (type) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to use camera is needed.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result?.canceled === true) return;
      const uri = result?.assets?.[0]?.uri || result?.uri;

      if (!uri) return;

      if (type === 'cr') {
        setCrImage(uri);
        setCrData(null);
        setValidationResult(null);
      } else {
        setOrImage(uri);
        setOrData(null);
        setValidationResult(null);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Show image source selection (modal instead of Alert)
  const showImageOptions = (type) => {
    setShowImageSourceModal(type);
  };

  const handleImageSourceSelect = async (source) => {
    const type = showImageSourceModal;
    setShowImageSourceModal(null);
    if (source === 'camera') {
      await takePhoto(type);
    } else {
      await pickImage(type);
    }
  };

  // Scan CR Document
  const scanCRDocument = async () => {
    if (!crImage) {
      Alert.alert('No Image', 'Please select or take a photo of the CR first');
      return;
    }

    setScanningCR(true);
    try {
      const formData = createImageFormData(crImage);
      
      const response = await fetch(`${BACKEND}/api/tricycles/scan/cr`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        setCrData(result.data.crData);
        
        // Auto-fill form fields from CR data
        if (result.data.crData.plateNumber) {
          setNewTricycle(prev => ({ ...prev, plateNumber: result.data.crData.plateNumber }));
        }
        if (result.data.crData.vehicleMake && result.data.crData.vehicleSeries) {
          setNewTricycle(prev => ({ 
            ...prev, 
            model: `${result.data.crData.vehicleMake} ${result.data.crData.vehicleSeries}` 
          }));
        }
        
        Alert.alert('Success', 'CR document scanned successfully!');
        
        // Auto-validate if both documents are scanned
        if (orData) {
          validateDocumentsData(result.data.crData, orData);
        }
      } else {
        Alert.alert('Error', result.message || 'Failed to scan CR document');
      }
    } catch (error) {
      console.error('CR scan error:', error);
      Alert.alert('Error', 'Failed to scan CR document. Please try again.');
    } finally {
      setScanningCR(false);
    }
  };

  // Scan OR Document
  const scanORDocument = async () => {
    if (!orImage) {
      Alert.alert('No Image', 'Please select or take a photo of the OR first');
      return;
    }

    setScanningOR(true);
    try {
      const formData = createImageFormData(orImage);
      
      const response = await fetch(`${BACKEND}/api/tricycles/scan/or`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        setOrData(result.data.orData);
        
        // Auto-fill plate number from OR if not already filled
        if (result.data.orData.plateNumber && !newTricycle.plateNumber) {
          setNewTricycle(prev => ({ ...prev, plateNumber: result.data.orData.plateNumber }));
        }
        
        Alert.alert('Success', 'OR document scanned successfully!');
        
        // Auto-validate if both documents are scanned
        if (crData) {
          validateDocumentsData(crData, result.data.orData);
        }
      } else {
        Alert.alert('Error', result.message || 'Failed to scan OR document');
      }
    } catch (error) {
      console.error('OR scan error:', error);
      Alert.alert('Error', 'Failed to scan OR document. Please try again.');
    } finally {
      setScanningOR(false);
    }
  };

  // Validate both documents
  const validateDocumentsData = async (cr, or) => {
    try {
      const response = await fetch(`${BACKEND}/api/tricycles/validate-documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ crData: cr, orData: or }),
      });

      const result = await response.json();
      
      if (result.success) {
        setValidationResult(result.data);
      }
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  // Handle form submission with document data
  const handleSubmitWithDocuments = () => {
    const tricycleData = {
      ...newTricycle,
      crData,
      orData,
      documentValidation: validationResult,
      crImage,
      orImage,
    };
    
    onSubmit(tricycleData);
  };

  // Reset state when modal closes
  const handleClose = () => {
    setActiveTab('basic');
    setCrImage(null);
    setOrImage(null);
    setCrData(null);
    setOrData(null);
    setValidationResult(null);
    setShowCRDetails(false);
    setShowORDetails(false);
    setShowImageSourceModal(null);
    setCrExpanded(false);
    setOrExpanded(false);
    onClose();
  };

  // Pretty field name mapping
  const FIELD_LABELS = {
    plateNumber: 'Plate Number',
    mvFileNumber: 'MV File No.',
    chassisNumber: 'Chassis No.',
    engineNumber: 'Engine No.',
    vehicleMake: 'Make',
    vehicleSeries: 'Series / Model',
    yearModel: 'Year Model',
    bodyType: 'Body Type',
    color: 'Color',
    fuelType: 'Fuel Type',
    dateOfInitialRegistration: 'Initial Reg. Date',
    registrationExpiryDate: 'Expiry Date',
    ltoOfficeCode: 'LTO Office',
    classification: 'Classification',
    denomination: 'Denomination',
    registeredOwnerName: 'Owner Name',
    ownerAddress: 'Address',
    orNumber: 'OR Number',
    orDate: 'OR Date',
    amountPaid: 'Amount Paid',
    paymentType: 'Payment Type',
    ltoCollectionOffice: 'LTO Office',
    validityCoverageYear: 'Validity Year',
  };

  const formatFieldValue = (key, value) => {
    if (!value) return '—';
    if (key === 'amountPaid') return `₱${Number(value).toLocaleString()}`;
    if (key.toLowerCase().includes('date') && value instanceof Date) {
      return new Date(value).toLocaleDateString();
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Render a compact field row
  const renderFieldRow = (key, value, icon) => {
    const label = FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').trim();
    return (
      <View key={key} style={scanStyles.fieldRow}>
        {icon && <Ionicons name={icon} size={14} color={colors.primary} style={{ marginRight: 6 }} />}
        <Text style={scanStyles.fieldLabel}>{label}</Text>
        <Text style={scanStyles.fieldValue} numberOfLines={1}>{formatFieldValue(key, value)}</Text>
      </View>
    );
  };

  // Render inline extracted data card
  const renderExtractedData = (data, type) => {
    if (!data) return null;
    const isExpanded = type === 'cr' ? crExpanded : orExpanded;
    const toggle = type === 'cr' ? () => setCrExpanded(!crExpanded) : () => setOrExpanded(!orExpanded);

    const importantKeys = type === 'cr'
      ? ['plateNumber', 'vehicleMake', 'vehicleSeries', 'engineNumber', 'chassisNumber', 'yearModel']
      : ['plateNumber', 'orNumber', 'orDate', 'amountPaid', 'paymentType'];

    const allKeys = Object.keys(data).filter(k => !['rawText', 'confidence'].includes(k) && data[k]);
    const extraKeys = allKeys.filter(k => !importantKeys.includes(k));

    const fieldIcon = (key) => {
      const map = {
        plateNumber: 'car-outline',
        vehicleMake: 'construct-outline',
        vehicleSeries: 'layers-outline',
        engineNumber: 'cog-outline',
        chassisNumber: 'hardware-chip-outline',
        yearModel: 'calendar-outline',
        orNumber: 'document-text-outline',
        orDate: 'calendar-outline',
        amountPaid: 'cash-outline',
        paymentType: 'card-outline',
      };
      return map[key] || null;
    };

    return (
      <View style={scanStyles.extractedCard}>
        <View style={scanStyles.extractedHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text style={scanStyles.extractedTitle}>Extracted Data</Text>
          </View>
          {data.confidence > 0 && (
            <View style={scanStyles.confidenceBadge}>
              <Text style={scanStyles.confidenceText}>{Math.round(data.confidence * 100)}%</Text>
            </View>
          )}
        </View>

        {importantKeys.map(k => data[k] ? renderFieldRow(k, data[k], fieldIcon(k)) : null)}

        {extraKeys.length > 0 && (
          <>
            <TouchableOpacity onPress={toggle} style={scanStyles.expandToggle}>
              <Text style={scanStyles.expandText}>
                {isExpanded ? 'Show Less' : `+${extraKeys.length} more fields`}
              </Text>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
            </TouchableOpacity>
            {isExpanded && extraKeys.map(k => renderFieldRow(k, data[k]))}
          </>
        )}
      </View>
    );
  };

  // Render validation status
  const renderValidationStatus = () => {
    if (!validationResult) return null;
    const isValid = validationResult.isValid;

    return (
      <View style={[scanStyles.validationCard, { borderLeftColor: isValid ? '#22C55E' : '#EF4444' }]}>
        <View style={scanStyles.validationHeader}>
          <View style={[scanStyles.validationIcon, { backgroundColor: isValid ? '#DCFCE7' : '#FEE2E2' }]}>
            <Ionicons
              name={isValid ? 'shield-checkmark' : 'shield-half'}
              size={20}
              color={isValid ? '#16A34A' : '#DC2626'}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[scanStyles.validationTitle, { color: isValid ? '#16A34A' : '#DC2626' }]}>
              {isValid ? 'Documents Match' : 'Issues Found'}
            </Text>
            <Text style={scanStyles.validationSubtitle}>
              {isValid ? 'CR and OR data are consistent' : 'Review mismatches below'}
            </Text>
          </View>
        </View>

        {validationResult.errors?.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {validationResult.errors.map((error, idx) => (
              <View key={idx} style={scanStyles.issueRow}>
                <Ionicons name="close-circle" size={14} color="#DC2626" />
                <Text style={[scanStyles.issueText, { color: '#991B1B' }]}>{error}</Text>
              </View>
            ))}
          </View>
        )}

        {validationResult.warnings?.length > 0 && (
          <View style={{ marginTop: 8 }}>
            {validationResult.warnings.map((warning, idx) => (
              <View key={idx} style={scanStyles.issueRow}>
                <Ionicons name="alert-circle" size={14} color="#D97706" />
                <Text style={[scanStyles.issueText, { color: '#92400E' }]}>{warning}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Render a single document scan card (CR or OR)
  const renderScanCard = (type) => {
    const isCR = type === 'cr';
    const image = isCR ? crImage : orImage;
    const scanning = isCR ? scanningCR : scanningOR;
    const data = isCR ? crData : orData;
    const anim = isCR ? crScanAnim : orScanAnim;
    const scanFn = isCR ? scanCRDocument : scanORDocument;
    const title = isCR ? 'Certificate of Registration (CR)' : 'Official Receipt (OR)';
    const icon = isCR ? 'document-text' : 'receipt';
    const statusIcon = data ? 'checkmark-circle' : image ? 'image' : 'add-circle-outline';
    const statusColor = data ? '#22C55E' : image ? colors.primary : '#9CA3AF';
    const statusText = data ? 'Scanned' : image ? 'Ready to scan' : 'No image';

    return (
      <View style={scanStyles.scanCard}>
        {/* Card Header */}
        <View style={scanStyles.scanCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[scanStyles.docIconWrap, { backgroundColor: isCR ? '#FFF7ED' : '#F0FDF4' }]}>
              <Ionicons name={icon} size={20} color={isCR ? colors.primary : '#16A34A'} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={scanStyles.scanCardTitle}>{title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Ionicons name={statusIcon} size={12} color={statusColor} />
                <Text style={[scanStyles.statusText, { color: statusColor }]}>{statusText}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Image Area */}
        {image ? (
          <View style={scanStyles.imageContainer}>
            <Image source={{ uri: image }} style={scanStyles.previewImage} resizeMode="cover" />
            
            {/* Scanning Overlay */}
            {scanning && (
              <View style={scanStyles.scanOverlay}>
                <Animated.View style={[scanStyles.scanLine, {
                  opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1, 0.3] }),
                  transform: [{
                    translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] }),
                  }],
                }]} />
                <View style={scanStyles.scanOverlayContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={scanStyles.scanOverlayText}>Scanning document...</Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={scanStyles.imageActions}>
              <TouchableOpacity
                style={scanStyles.imageActionBtn}
                onPress={() => showImageOptions(type)}
                disabled={scanning}
              >
                <Ionicons name="camera-reverse-outline" size={16} color="#fff" />
                <Text style={scanStyles.imageActionText}>Change</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[scanStyles.imageActionBtn, scanStyles.scanBtn, scanning && { opacity: 0.6 }]}
                onPress={scanFn}
                disabled={scanning}
              >
                {scanning ? (
                  <ActivityIndicator color="#fff" size={14} />
                ) : (
                  <Ionicons name="scan-outline" size={16} color="#fff" />
                )}
                <Text style={scanStyles.imageActionText}>{scanning ? 'Scanning...' : data ? 'Re-scan' : 'Scan'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={scanStyles.uploadArea} onPress={() => showImageOptions(type)}>
            <View style={scanStyles.uploadIconWrap}>
              <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />
            </View>
            <Text style={scanStyles.uploadTitle}>Add {isCR ? 'CR' : 'OR'} Document</Text>
            <Text style={scanStyles.uploadSubtext}>Take a photo or choose from gallery</Text>
          </TouchableOpacity>
        )}

        {/* Extracted Data (inline) */}
        {renderExtractedData(data, type)}
      </View>
    );
  };

  // Image Source Picker Modal
  const renderImageSourceModal = () => (
    <Modal visible={showImageSourceModal !== null} transparent animationType="fade" onRequestClose={() => setShowImageSourceModal(null)}>
      <TouchableWithoutFeedback onPress={() => setShowImageSourceModal(null)}>
        <View style={scanStyles.bottomSheetOverlay}>
          <TouchableWithoutFeedback>
            <View style={scanStyles.bottomSheet}>
              <View style={scanStyles.bottomSheetHandle} />
              <Text style={scanStyles.bottomSheetTitle}>
                Select {showImageSourceModal === 'cr' ? 'CR' : 'OR'} Image
              </Text>

              <TouchableOpacity style={scanStyles.sourceOption} onPress={() => handleImageSourceSelect('camera')}>
                <View style={[scanStyles.sourceIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="camera" size={22} color="#3B82F6" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={scanStyles.sourceOptionTitle}>Camera</Text>
                  <Text style={scanStyles.sourceOptionDesc}>Take a photo of the document</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity style={scanStyles.sourceOption} onPress={() => handleImageSourceSelect('gallery')}>
                <View style={[scanStyles.sourceIconWrap, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="images" size={22} color="#22C55E" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={scanStyles.sourceOptionTitle}>Gallery</Text>
                  <Text style={scanStyles.sourceOptionDesc}>Choose from photo library</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={scanStyles.bottomSheetCancel}
                onPress={() => setShowImageSourceModal(null)}
              >
                <Text style={scanStyles.bottomSheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView 
          style={styles.modalContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            {/* Tab Switcher */}
            <View style={scanStyles.tabBar}>
              <TouchableOpacity
                style={[scanStyles.tab, activeTab === 'basic' && scanStyles.tabActive]}
                onPress={() => setActiveTab('basic')}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={activeTab === 'basic' ? '#fff' : '#6B7280'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[scanStyles.tabText, activeTab === 'basic' && scanStyles.tabTextActive]}>
                  Basic Info
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[scanStyles.tab, activeTab === 'documents' && scanStyles.tabActive]}
                onPress={() => setActiveTab('documents')}
              >
                <Ionicons
                  name="scan-outline"
                  size={16}
                  color={activeTab === 'documents' ? '#fff' : '#6B7280'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[scanStyles.tabText, activeTab === 'documents' && scanStyles.tabTextActive]}>
                  Document Scan
                </Text>
                {(crData || orData) && (
                  <View style={scanStyles.tabBadge}>
                    <Text style={scanStyles.tabBadgeText}>{(crData ? 1 : 0) + (orData ? 1 : 0)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1 }}
            >
              <Text style={styles.modalTitle}>Add New Tricycle</Text>
              
              {activeTab === 'basic' ? (
                <>
                  {/* Basic Info Tab */}
                  <TextInput
                    style={styles.textInput}
                    placeholder="Plate Number"
                    value={newTricycle.plateNumber}
                    onChangeText={(text) => setNewTricycle({ ...newTricycle, plateNumber: text.toUpperCase() })}
                    editable={!creating}
                  />

                  <TextInput
                    style={styles.textInput}
                    placeholder="Body Number"
                    value={newTricycle.bodyNumber}
                    onChangeText={(text) => {
                      // Allow digits only and limit to 4 characters
                      const sanitized = (text || '').replace(/\D/g, '').slice(0, 4);
                      setNewTricycle({ ...newTricycle, bodyNumber: sanitized });
                    }}
                    keyboardType="numeric"
                    maxLength={4}
                    editable={!creating}
                  />
                  
                  {/* Model Dropdown */}
                  <TouchableOpacity
                    style={[styles.textInput, { justifyContent: 'center' }]}
                    onPress={() => !creating && setShowModelPicker(true)}
                    disabled={creating}
                  >
                    <Text style={{ color: newTricycle.model ? '#000' : '#999' }}>
                      {newTricycle.model || 'Select Model'}
                    </Text>
                  </TouchableOpacity>

                  {/* Model Picker Modal */}
                  <Modal visible={showModelPicker} animationType="slide" transparent>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                      <KeyboardAvoidingView 
                        style={styles.modalContainer}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                      >
                        <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                          {!showOtherInput ? (
                            <>
                              <Text style={styles.modalTitle}>Select Motorcycle Model</Text>
                              <ScrollView 
                                style={{ width: '100%' }}
                                keyboardShouldPersistTaps="handled"
                              >
                                {MOTORCYCLE_MODELS.map((brandGroup) => (
                                  <View key={brandGroup.brand} style={{ marginBottom: 15 }}>
                                    <Text style={{
                                      fontSize: 16,
                                      fontWeight: 'bold',
                                      color: colors.primary,
                                      marginBottom: 8,
                                      paddingLeft: 5,
                                    }}>
                                      {brandGroup.brand}
                                    </Text>
                                    {brandGroup.models.map((model) => (
                                      <TouchableOpacity
                                        key={model}
                                        style={{
                                          padding: 12,
                                          backgroundColor: '#f5f5f5',
                                          borderRadius: 8,
                                          marginBottom: 5,
                                        }}
                                        onPress={() => handleModelSelect(brandGroup.brand, model)}
                                      >
                                        <Text style={{ fontSize: 14, color: '#333' }}>{model}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                ))}
                                {/* Others Option */}
                                <View style={{ marginBottom: 15 }}>
                                  <Text style={{
                                    fontSize: 16,
                                    fontWeight: 'bold',
                                    color: colors.primary,
                                    marginBottom: 8,
                                    paddingLeft: 5,
                                  }}>
                                    Other
                                  </Text>
                                  <TouchableOpacity
                                    style={{
                                      padding: 12,
                                      backgroundColor: '#f5f5f5',
                                      borderRadius: 8,
                                      marginBottom: 5,
                                    }}
                                    onPress={() => setShowOtherInput(true)}
                                  >
                                    <Text style={{ fontSize: 14, color: '#333' }}>Enter Custom Model</Text>
                                  </TouchableOpacity>
                                </View>
                              </ScrollView>
                              <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: '#6c757d', marginTop: 10, width: '100%' }]}
                                onPress={() => setShowModelPicker(false)}
                              >
                                <Text style={styles.modalBtnText}>Cancel</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <Text style={styles.modalTitle}>Enter Motorcycle Model</Text>
                              <TextInput
                                style={styles.textInput}
                                placeholder="e.g., Kawasaki Barako, Rusi Custom"
                                value={customModel}
                                onChangeText={setCustomModel}
                                editable={!creating}
                                autoFocus
                              />
                              <View style={styles.modalActions}>
                                <TouchableOpacity
                                  style={[styles.modalBtn, { backgroundColor: '#6c757d' }]}
                                  onPress={() => {
                                    setShowOtherInput(false);
                                    setCustomModel('');
                                  }}
                                >
                                  <Text style={styles.modalBtnText}>Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                                  onPress={handleOtherModelSubmit}
                                  disabled={!customModel.trim() || creating}
                                >
                                  <Text style={styles.modalBtnText}>Submit</Text>
                                </TouchableOpacity>
                              </View>
                            </>
                          )}
                        </View>
                      </KeyboardAvoidingView>
                    </TouchableWithoutFeedback>
                  </Modal>
                  
                  <TextInput
                    style={styles.textInput}
                    placeholder="Initial Odometer (km)"
                    value={newTricycle.currentOdometer}
                    onChangeText={(text) => setNewTricycle({ ...newTricycle, currentOdometer: text })}
                    keyboardType="numeric"
                    editable={!creating}
                  />

                  {/* Coding Day Dropdown */}
                  <TouchableOpacity
                    style={[styles.textInput, { justifyContent: 'center' }]}
                    onPress={() => !creating && setShowCodingDayPicker(true)}
                    disabled={creating}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: newTricycle.codingDay !== undefined && newTricycle.codingDay !== null ? '#000' : '#999' }}>
                        {newTricycle.codingDay !== undefined && newTricycle.codingDay !== null 
                          ? `Coding Day: ${getDayName(newTricycle.codingDay)}` 
                          : 'Select Coding Day (Optional)'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#666" />
                    </View>
                  </TouchableOpacity>

                  {/* Coding Day Info */}
                  <View style={{ 
                    backgroundColor: '#fff3cd', 
                    padding: 10, 
                    borderRadius: 8, 
                    marginTop: 5,
                    flexDirection: 'row',
                    alignItems: 'flex-start'
                  }}>
                    <Ionicons name="information-circle" size={18} color="#856404" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={{ color: '#856404', fontSize: 12, flex: 1 }}>
                      Coding Day: The driver will not be able to drive this tricycle on the selected day each week. This helps manage traffic and ensure fair rotation.
                    </Text>
                  </View>

                  {/* Coding Day Picker Modal */}
                  <Modal visible={showCodingDayPicker} animationType="slide" transparent>
                    <TouchableWithoutFeedback onPress={() => setShowCodingDayPicker(false)}>
                      <View style={styles.modalContainer}>
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                          <View style={[styles.modalContent, { maxHeight: '60%' }]}>
                            <Text style={styles.modalTitle}>Select Coding Day</Text>
                            <Text style={{ fontSize: 12, color: '#666', marginBottom: 15, textAlign: 'center' }}>
                              Choose the day when this tricycle cannot operate
                            </Text>
                            <ScrollView style={{ width: '100%' }}>
                              {CODING_DAYS.map((day) => (
                                <TouchableOpacity
                                  key={day.value === null ? 'none' : day.value}
                                  style={{
                                    padding: 15,
                                    backgroundColor: newTricycle.codingDay === day.value ? colors.primary : '#f5f5f5',
                                    borderRadius: 8,
                                    marginBottom: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                  }}
                                  onPress={() => {
                                    setNewTricycle({ ...newTricycle, codingDay: day.value });
                                    setShowCodingDayPicker(false);
                                  }}
                                >
                                  <Text style={{ 
                                    fontSize: 16, 
                                    color: newTricycle.codingDay === day.value ? '#fff' : '#333',
                                    fontWeight: newTricycle.codingDay === day.value ? 'bold' : 'normal'
                                  }}>
                                    {day.label}
                                  </Text>
                                  {newTricycle.codingDay === day.value && (
                                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                  )}
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                            <TouchableOpacity
                              style={[styles.modalBtn, { backgroundColor: '#6c757d', marginTop: 10, width: '100%' }]}
                              onPress={() => setShowCodingDayPicker(false)}
                            >
                              <Text style={styles.modalBtnText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableWithoutFeedback>
                      </View>
                    </TouchableWithoutFeedback>
                  </Modal>
                </>
              ) : (
                <>
                  {/* Documents Tab */}
                  <View style={scanStyles.docHint}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                    <Text style={scanStyles.docHintText}>
                      Upload and scan your CR & OR to auto-fill vehicle details and cross-validate documents.
                    </Text>
                  </View>

                  {/* CR Scan Card */}
                  {renderScanCard('cr')}

                  {/* OR Scan Card */}
                  {renderScanCard('or')}

                  {/* Validation Result */}
                  {renderValidationStatus()}

                  {/* Validate Button */}
                  {crData && orData && !validationResult && (
                    <TouchableOpacity style={scanStyles.validateBtn} onPress={() => validateDocumentsData(crData, orData)}>
                      <Ionicons name="shield-checkmark-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={scanStyles.validateBtnText}>Cross-Validate Documents</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
            
            <View style={[styles.modalActions, { marginTop: 10 }]}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#6c757d' }]} 
                onPress={handleClose} 
                disabled={creating}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: colors.primary }]} 
                onPress={activeTab === 'documents' && (crData || orData) ? handleSubmitWithDocuments : () => onSubmit(newTricycle)} 
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
      
      {/* Image Source Picker */}
      {renderImageSourceModal()}
    </Modal>
  );
}

// ========== Scan-specific styles ==========
const scanStyles = StyleSheet.create({
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginBottom: 15,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: '#22C55E',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Document hint
  docHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF7ED',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  docHintText: {
    color: '#92400E',
    fontSize: 12,
    flex: 1,
    marginLeft: 8,
    lineHeight: 18,
  },

  // Scan card
  scanCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  scanCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  docIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },

  // Image area
  imageContainer: {
    position: 'relative',
    margin: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  scanOverlayContent: {
    alignItems: 'center',
  },
  scanOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  imageActions: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  imageActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 3,
  },
  scanBtn: {
    backgroundColor: colors.primary,
  },
  imageActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 5,
  },

  // Upload area (no image yet)
  uploadArea: {
    margin: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  uploadIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  uploadSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },

  // Extracted data
  extractedCard: {
    backgroundColor: '#F9FAFB',
    margin: 12,
    marginTop: 0,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  extractedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  extractedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
    marginLeft: 6,
  },
  confidenceBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  fieldLabel: {
    fontSize: 11,
    color: '#6B7280',
    width: 95,
    fontWeight: '500',
  },
  fieldValue: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
    textAlign: 'right',
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  expandText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginRight: 4,
  },

  // Validation card
  validationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  validationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  validationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validationTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  validationSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 4,
  },
  issueText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
    lineHeight: 18,
  },

  // Validate button
  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  validateBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Bottom sheet (image source picker)
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  sourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 10,
  },
  sourceIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  sourceOptionDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  bottomSheetCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  bottomSheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
});
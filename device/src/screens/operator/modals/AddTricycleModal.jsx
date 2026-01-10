import React, { useState } from 'react';
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../../../components/common/theme';
import styles from '../operatorStyles';

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

  // Show image source selection
  const showImageOptions = (type) => {
    Alert.alert(
      `Select ${type === 'cr' ? 'CR' : 'OR'} Image`,
      'Choose an option',
      [
        { text: 'Camera', onPress: () => takePhoto(type) },
        { text: 'Gallery', onPress: () => pickImage(type) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
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
    onClose();
  };

  // Render validation status
  const renderValidationStatus = () => {
    if (!validationResult) return null;

    return (
      <View style={{
        backgroundColor: validationResult.isValid ? '#d4edda' : '#f8d7da',
        padding: 12,
        borderRadius: 8,
        marginTop: 10,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons 
            name={validationResult.isValid ? 'checkmark-circle' : 'warning'} 
            size={20} 
            color={validationResult.isValid ? '#155724' : '#721c24'} 
          />
          <Text style={{ 
            marginLeft: 8, 
            fontWeight: 'bold',
            color: validationResult.isValid ? '#155724' : '#721c24'
          }}>
            {validationResult.isValid ? 'Documents Validated' : 'Validation Issues Found'}
          </Text>
        </View>
        
        {validationResult.errors?.length > 0 && (
          <View style={{ marginTop: 5 }}>
            {validationResult.errors.map((error, idx) => (
              <Text key={idx} style={{ color: '#721c24', fontSize: 12 }}>• {error}</Text>
            ))}
          </View>
        )}
        
        {validationResult.warnings?.length > 0 && (
          <View style={{ marginTop: 5 }}>
            {validationResult.warnings.map((warning, idx) => (
              <Text key={idx} style={{ color: '#856404', fontSize: 12 }}>⚠ {warning}</Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Render CR details modal
  const renderCRDetailsModal = () => (
    <Modal visible={showCRDetails} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { maxHeight: '80%' }]}>
          <Text style={styles.modalTitle}>CR Details</Text>
          <ScrollView style={{ width: '100%' }}>
            {crData && Object.entries(crData).map(([key, value]) => {
              if (key === 'rawText' || key === 'confidence' || !value) return null;
              return (
                <View key={key} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, color: '#666', textTransform: 'capitalize' }}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#333' }}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: '#6c757d', marginTop: 10, width: '100%' }]}
            onPress={() => setShowCRDetails(false)}
          >
            <Text style={styles.modalBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Render OR details modal
  const renderORDetailsModal = () => (
    <Modal visible={showORDetails} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { maxHeight: '80%' }]}>
          <Text style={styles.modalTitle}>OR Details</Text>
          <ScrollView style={{ width: '100%' }}>
            {orData && Object.entries(orData).map(([key, value]) => {
              if (key === 'rawText' || key === 'confidence' || !value) return null;
              return (
                <View key={key} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, color: '#666', textTransform: 'capitalize' }}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#333' }}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: '#6c757d', marginTop: 10, width: '100%' }]}
            onPress={() => setShowORDetails(false)}
          >
            <Text style={styles.modalBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
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
            <View style={{ flexDirection: 'row', marginBottom: 15, borderRadius: 8, overflow: 'hidden' }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  padding: 10,
                  backgroundColor: activeTab === 'basic' ? colors.primary : '#e9ecef',
                  alignItems: 'center',
                }}
                onPress={() => setActiveTab('basic')}
              >
                <Text style={{ color: activeTab === 'basic' ? '#fff' : '#333', fontWeight: 'bold' }}>
                  Basic Info
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  padding: 10,
                  backgroundColor: activeTab === 'documents' ? colors.primary : '#e9ecef',
                  alignItems: 'center',
                }}
                onPress={() => setActiveTab('documents')}
              >
                <Text style={{ color: activeTab === 'documents' ? '#fff' : '#333', fontWeight: 'bold' }}>
                  CR / OR Scan
                </Text>
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
                </>
              ) : (
                <>
                  {/* Documents Tab */}
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 15, textAlign: 'center' }}>
                    Scan CR & OR documents to auto-fill and validate information
                  </Text>

                  {/* CR Section */}
                  <View style={{ 
                    backgroundColor: '#f8f9fa', 
                    padding: 12, 
                    borderRadius: 8, 
                    marginBottom: 15 
                  }}>
                    <Text style={{ fontWeight: 'bold', marginBottom: 10, color: colors.primary }}>
                      Certificate of Registration (CR)
                    </Text>
                    
                    {crImage ? (
                      <View>
                        <Image 
                          source={{ uri: crImage }} 
                          style={{ 
                            width: '100%', 
                            height: 150, 
                            borderRadius: 8,
                            marginBottom: 10 
                          }} 
                          resizeMode="cover"
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              backgroundColor: '#6c757d',
                              padding: 10,
                              borderRadius: 8,
                              marginRight: 5,
                              alignItems: 'center',
                            }}
                            onPress={() => showImageOptions('cr')}
                          >
                            <Text style={{ color: '#fff', fontSize: 12 }}>Change</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              backgroundColor: colors.primary,
                              padding: 10,
                              borderRadius: 8,
                              marginLeft: 5,
                              alignItems: 'center',
                            }}
                            onPress={scanCRDocument}
                            disabled={scanningCR}
                          >
                            {scanningCR ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Text style={{ color: '#fff', fontSize: 12 }}>Scan OCR</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                        
                        {crData && (
                          <TouchableOpacity
                            style={{
                              backgroundColor: '#28a745',
                              padding: 8,
                              borderRadius: 8,
                              marginTop: 10,
                              alignItems: 'center',
                              flexDirection: 'row',
                              justifyContent: 'center',
                            }}
                            onPress={() => setShowCRDetails(true)}
                          >
                            <Ionicons name="checkmark-circle" size={16} color="#fff" />
                            <Text style={{ color: '#fff', marginLeft: 5, fontSize: 12 }}>
                              View Extracted Data
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={{
                          borderWidth: 2,
                          borderColor: '#dee2e6',
                          borderStyle: 'dashed',
                          borderRadius: 8,
                          padding: 30,
                          alignItems: 'center',
                        }}
                        onPress={() => showImageOptions('cr')}
                      >
                        <MaterialCommunityIcons name="file-document-outline" size={40} color="#adb5bd" />
                        <Text style={{ color: '#6c757d', marginTop: 10 }}>
                          Tap to add CR image
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* OR Section */}
                  <View style={{ 
                    backgroundColor: '#f8f9fa', 
                    padding: 12, 
                    borderRadius: 8, 
                    marginBottom: 15 
                  }}>
                    <Text style={{ fontWeight: 'bold', marginBottom: 10, color: colors.primary }}>
                      Official Receipt (OR)
                    </Text>
                    
                    {orImage ? (
                      <View>
                        <Image 
                          source={{ uri: orImage }} 
                          style={{ 
                            width: '100%', 
                            height: 150, 
                            borderRadius: 8,
                            marginBottom: 10 
                          }} 
                          resizeMode="cover"
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              backgroundColor: '#6c757d',
                              padding: 10,
                              borderRadius: 8,
                              marginRight: 5,
                              alignItems: 'center',
                            }}
                            onPress={() => showImageOptions('or')}
                          >
                            <Text style={{ color: '#fff', fontSize: 12 }}>Change</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              backgroundColor: colors.primary,
                              padding: 10,
                              borderRadius: 8,
                              marginLeft: 5,
                              alignItems: 'center',
                            }}
                            onPress={scanORDocument}
                            disabled={scanningOR}
                          >
                            {scanningOR ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Text style={{ color: '#fff', fontSize: 12 }}>Scan OCR</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                        
                        {orData && (
                          <TouchableOpacity
                            style={{
                              backgroundColor: '#28a745',
                              padding: 8,
                              borderRadius: 8,
                              marginTop: 10,
                              alignItems: 'center',
                              flexDirection: 'row',
                              justifyContent: 'center',
                            }}
                            onPress={() => setShowORDetails(true)}
                          >
                            <Ionicons name="checkmark-circle" size={16} color="#fff" />
                            <Text style={{ color: '#fff', marginLeft: 5, fontSize: 12 }}>
                              View Extracted Data
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={{
                          borderWidth: 2,
                          borderColor: '#dee2e6',
                          borderStyle: 'dashed',
                          borderRadius: 8,
                          padding: 30,
                          alignItems: 'center',
                        }}
                        onPress={() => showImageOptions('or')}
                      >
                        <MaterialCommunityIcons name="receipt" size={40} color="#adb5bd" />
                        <Text style={{ color: '#6c757d', marginTop: 10 }}>
                          Tap to add OR image
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Validation Result */}
                  {renderValidationStatus()}

                  {/* Validate Button */}
                  {crData && orData && !validationResult && (
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#17a2b8',
                        padding: 12,
                        borderRadius: 8,
                        marginTop: 10,
                        alignItems: 'center',
                      }}
                      onPress={() => validateDocumentsData(crData, orData)}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                        Validate Documents
                      </Text>
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
      
      {/* CR Details Modal */}
      {renderCRDetailsModal()}
      
      {/* OR Details Modal */}
      {renderORDetailsModal()}
    </Modal>
  );
}
/**
 * ComplaintScreen.jsx - Guest Complaint Filing Screen
 *
 * Allows users to file complaints against drivers with:
 * - Required photo/video evidence
 * - Anti-abuse measures (rate limiting, credibility scoring)
 * - Recent bookings context
 * - Driver search functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
  FlatList,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import Constants from 'expo-constants';

import { colors, spacing } from '../../components/common/theme';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { getToken } from '../../utils/jwtStorage';

const BACKEND_URL = Constants.expoConfig?.extra?.BACKEND_URL || 'http://192.168.254.105:5000';
const API_URL = `${BACKEND_URL}/api/complaints`;

const ComplaintScreen = ({ navigation }) => {
  const db = useAsyncSQLiteContext();
  
  // View state
  const [activeView, setActiveView] = useState('file'); // 'file' or 'history'
  
  // Form state
  const [canFile, setCanFile] = useState(true);
  const [canFileMessage, setCanFileMessage] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [incidentDate, setIncidentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tricycleDetails, setTricycleDetails] = useState({
    plateNumber: '',
    bodyNumber: '',
    description: '',
  });
  
  // Driver selection
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [driverSearch, setDriverSearch] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  
  // Booking selection
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  
  // Complaints history
  const [myComplaints, setMyComplaints] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showComplaintDetail, setShowComplaintDetail] = useState(false);
  
  // Sentiment Analysis state
  const [sentimentAnalysis, setSentimentAnalysis] = useState(null);
  const [analyzingSentiment, setAnalyzingSentiment] = useState(false);
  
  // Body Number OCR Detection state
  const [scanningBodyNumber, setScanningBodyNumber] = useState(false);
  const [bodyNumberDetection, setBodyNumberDetection] = useState(null);
  const [showBodyNumberScanner, setShowBodyNumberScanner] = useState(false);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Initialize
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        checkCanFile(),
        fetchCategories(),
        fetchMyComplaints(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkCanFile = async () => {
    try {
      const token = await getToken(db);
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/can-file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setCanFile(response.data.canFile);
      if (!response.data.canFile) {
        setCanFileMessage(response.data.reason);
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/categories`);
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchMyComplaints = async () => {
    try {
      setLoadingComplaints(true);
      const token = await getToken(db);
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/my-complaints`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setMyComplaints(response.data.complaints);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoadingComplaints(false);
    }
  };

  const searchDrivers = async (search) => {
    try {
      setLoadingDrivers(true);
      const token = await getToken(db);
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/drivers`, {
        params: { search },
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setDrivers(response.data.drivers);
    } catch (error) {
      console.error('Error searching drivers:', error);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const fetchRecentBookings = async () => {
    try {
      setLoadingBookings(true);
      const token = await getToken(db);
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/recent-bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setRecentBookings(response.data.bookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Image picker
  const pickImage = async () => {
    if (evidence.length >= 5) {
      Alert.alert('Limit Reached', 'You can upload a maximum of 5 images.');
      return;
    }
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll permission is required to upload evidence.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true,
      selectionLimit: 5 - evidence.length,
    });
    
    if (!result.canceled && result.assets) {
      const newEvidence = result.assets.map(asset => ({
        uri: `data:image/jpeg;base64,${asset.base64}`,
        preview: asset.uri,
      }));
      setEvidence([...evidence, ...newEvidence]);
    }
  };

  const takePhoto = async () => {
    if (evidence.length >= 5) {
      Alert.alert('Limit Reached', 'You can upload a maximum of 5 images.');
      return;
    }
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
    });
    
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setEvidence([...evidence, {
        uri: `data:image/jpeg;base64,${asset.base64}`,
        preview: asset.uri,
      }]);
    }
  };

  const removeEvidence = (index) => {
    setEvidence(evidence.filter((_, i) => i !== index));
  };

  // Analyze sentiment of description
  const analyzeSentiment = async () => {
    if (description.length < 20) {
      Alert.alert('Description Too Short', 'Please write at least 20 characters to analyze sentiment.');
      return;
    }
    
    try {
      setAnalyzingSentiment(true);
      const token = await getToken(db);
      if (!token) return;
      
      const response = await axios.post(`${API_URL}/analyze-sentiment`, {
        description,
        category: selectedCategory,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.success) {
        setSentimentAnalysis(response.data);
      }
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
    } finally {
      setAnalyzingSentiment(false);
    }
  };

  // Body number OCR detection from camera
  const scanBodyNumber = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to scan body numbers.');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets?.[0]) {
        setScanningBodyNumber(true);
        const asset = result.assets[0];
        
        const token = await getToken(db);
        if (!token) {
          Alert.alert('Error', 'Please login to use this feature.');
          return;
        }
        
        // Create form data with the image
        const formData = new FormData();
        formData.append('image', {
          uri: asset.uri,
          type: 'image/jpeg',
          name: 'body_number.jpg',
        });
        
        const response = await axios.post(`${API_URL}/detect-body-number`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        
        if (response.data.success) {
          setBodyNumberDetection(response.data);
          
          // Auto-fill body number
          setTricycleDetails(prev => ({
            ...prev,
            bodyNumber: response.data.bodyNumber,
          }));
          
          // If tricycle was found in database, offer to auto-fill driver
          if (response.data.tricycleMatch?.driver) {
            Alert.alert(
              'Tricycle Found!',
              `Body number ${response.data.bodyNumber} is registered to ${response.data.tricycleMatch.driver.name}. Would you like to select this driver?`,
              [
                { text: 'No, keep manual entry', style: 'cancel' },
                { 
                  text: 'Yes, select driver', 
                  onPress: () => {
                    setSelectedDriver({
                      _id: response.data.tricycleMatch.driver._id,
                      firstname: response.data.tricycleMatch.driver.name.split(' ')[0],
                      lastname: response.data.tricycleMatch.driver.name.split(' ').slice(1).join(' '),
                      image: { url: response.data.tricycleMatch.driver.profilePicture },
                    });
                    setTricycleDetails({ plateNumber: '', bodyNumber: '', description: '' });
                  }
                },
              ]
            );
          } else {
            Alert.alert(
              'Body Number Detected',
              `Detected: ${response.data.bodyNumber} (${response.data.confidence}% confidence)\n\n${response.data.message}`,
              [{ text: 'OK' }]
            );
          }
        } else {
          Alert.alert(
            'Detection Failed',
            response.data.message || 'Could not detect body number. Please try again or enter manually.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error scanning body number:', error);
      Alert.alert('Error', 'Failed to scan body number. Please try again or enter manually.');
    } finally {
      setScanningBodyNumber(false);
    }
  };

  // Lookup body number in database
  const lookupBodyNumber = async () => {
    const bodyNumber = tricycleDetails.bodyNumber.trim();
    if (!bodyNumber) {
      Alert.alert('Enter Body Number', 'Please enter a body number to lookup.');
      return;
    }
    
    try {
      setScanningBodyNumber(true);
      const token = await getToken(db);
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/lookup-body-number/${bodyNumber}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.success && response.data.tricycle) {
        const tricycle = response.data.tricycle;
        
        if (tricycle.driver) {
          Alert.alert(
            'Tricycle Found!',
            `Body number ${tricycle.bodyNumber} is registered.\n\nPlate: ${tricycle.plateNumber}\nDriver: ${tricycle.driver.name}`,
            [
              { text: 'Keep manual entry', style: 'cancel' },
              { 
                text: 'Select this driver', 
                onPress: () => {
                  setSelectedDriver({
                    _id: tricycle.driver._id,
                    firstname: tricycle.driver.name.split(' ')[0],
                    lastname: tricycle.driver.name.split(' ').slice(1).join(' '),
                    image: { url: tricycle.driver.profilePicture },
                  });
                  setTricycleDetails({ plateNumber: '', bodyNumber: '', description: '' });
                }
              },
            ]
          );
        } else {
          Alert.alert(
            'Tricycle Found',
            `Body number ${tricycle.bodyNumber} is registered but has no assigned driver.\n\nPlate: ${tricycle.plateNumber}`,
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          'Not Found',
          `Body number "${bodyNumber}" is not registered in our system.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error looking up body number:', error);
      Alert.alert('Error', 'Failed to lookup body number.');
    } finally {
      setScanningBodyNumber(false);
    }
  };

  // Auto-analyze sentiment when description changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (description.length >= 50 && selectedCategory) {
        analyzeSentiment();
      } else {
        setSentimentAnalysis(null);
      }
    }, 1000); // Wait 1 second after user stops typing
    
    return () => clearTimeout(timer);
  }, [description, selectedCategory]);

  // Form validation
  const validateForm = () => {
    if (!selectedDriver && !tricycleDetails.plateNumber && !tricycleDetails.bodyNumber) {
      Alert.alert('Missing Information', 'Please select a driver or provide tricycle details (plate number or body number).');
      return false;
    }
    
    if (!selectedCategory) {
      Alert.alert('Missing Category', 'Please select a complaint category.');
      return false;
    }
    
    if (!description || description.length < 50) {
      Alert.alert('Description Required', 'Please provide a detailed description (at least 50 characters).');
      return false;
    }
    
    if (evidence.length === 0) {
      Alert.alert(
        'Evidence Required',
        'At least one photo is required to file a complaint. This helps us verify your claim and protects against false accusations.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    return true;
  };

  // Submit complaint
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    Alert.alert(
      'Submit Complaint',
      'Are you sure you want to submit this complaint? Filing false or defamatory complaints may result in restrictions on your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: submitComplaint },
      ]
    );
  };

  const submitComplaint = async () => {
    try {
      setSubmitting(true);
      const token = await getToken(db);
      if (!token) {
        Alert.alert('Error', 'Please log in to file a complaint.');
        return;
      }
      
      const complaintData = {
        driverId: selectedDriver?._id,
        bookingId: selectedBooking?._id,
        category: selectedCategory,
        description,
        evidence: evidence.map(e => e.uri),
        incidentDate: incidentDate.toISOString(),
        tricycleDetails: {
          plateNumber: tricycleDetails.plateNumber,
          bodyNumber: tricycleDetails.bodyNumber,
          description: tricycleDetails.description,
        },
      };
      
      const response = await axios.post(API_URL, complaintData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.data.success) {
        Alert.alert(
          'Complaint Submitted',
          response.data.message,
          [{ text: 'OK', onPress: resetForm }]
        );
        fetchMyComplaints();
      }
    } catch (error) {
      console.error('Error submitting complaint:', error);
      Alert.alert(
        'Submission Failed',
        error.response?.data?.message || 'Failed to submit complaint. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedDriver(null);
    setSelectedBooking(null);
    setSelectedCategory(null);
    setDescription('');
    setEvidence([]);
    setIncidentDate(new Date());
    setTricycleDetails({ plateNumber: '', bodyNumber: '', description: '' });
    checkCanFile();
  };

  // Withdraw complaint
  const handleWithdraw = (complaintId) => {
    Alert.alert(
      'Withdraw Complaint',
      'Are you sure you want to withdraw this complaint?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Withdraw', style: 'destructive', onPress: () => withdrawComplaint(complaintId) },
      ]
    );
  };

  const withdrawComplaint = async (complaintId) => {
    try {
      const token = await getToken(db);
      if (!token) return;
      
      await axios.put(`${API_URL}/${complaintId}/withdraw`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      Alert.alert('Success', 'Complaint withdrawn successfully.');
      fetchMyComplaints();
      setShowComplaintDetail(false);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to withdraw complaint.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    const statusColors = {
      pending: '#FFA500',
      under_review: '#3498DB',
      investigating: '#9B59B6',
      resolved: '#27AE60',
      dismissed: '#95A5A6',
      withdrawn: '#7F8C8D',
    };
    return statusColors[status] || '#666';
  };

  // Get status label
  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending Review',
      under_review: 'Under Review',
      investigating: 'Investigating',
      resolved: 'Resolved',
      dismissed: 'Dismissed',
      withdrawn: 'Withdrawn',
    };
    return labels[status] || status;
  };

  // Render category item
  const renderCategoryItem = (category) => (
    <TouchableOpacity
      key={category.value}
      style={[
        styles.categoryItem,
        selectedCategory === category.value && styles.categoryItemSelected,
      ]}
      onPress={() => setSelectedCategory(category.value)}
    >
      <View style={styles.categoryContent}>
        <Text style={[
          styles.categoryLabel,
          selectedCategory === category.value && styles.categoryLabelSelected,
        ]}>
          {category.label}
        </Text>
        <Text style={styles.categoryDescription}>{category.description}</Text>
      </View>
      {selectedCategory === category.value && (
        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  // Render file complaint form
  const renderFileForm = () => (
    <ScrollView
      style={styles.formContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
        />
      }
    >
      {/* Warning Banner */}
      <View style={styles.warningBanner}>
        <Ionicons name="warning-outline" size={24} color="#856404" />
        <View style={styles.warningContent}>
          <Text style={styles.warningTitle}>Important Notice</Text>
          <Text style={styles.warningText}>
            Filing false or defamatory complaints is a serious offense. Provide accurate information and valid evidence. False complaints may result in account restrictions.
          </Text>
        </View>
      </View>

      {/* Can't File Message */}
      {!canFile && (
        <View style={styles.errorBanner}>
          <Ionicons name="ban-outline" size={24} color="#721c24" />
          <Text style={styles.errorText}>{canFileMessage}</Text>
        </View>
      )}

      {canFile && (
        <>
          {/* Driver Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="person-outline" size={18} color={colors.primary} /> Driver Information
            </Text>
            <Text style={styles.sectionSubtitle}>Select the driver or provide tricycle details</Text>
            
            {selectedDriver ? (
              <View style={styles.selectedDriverCard}>
                <View style={styles.driverInfo}>
                  {selectedDriver.image?.url ? (
                    <Image source={{ uri: selectedDriver.image.url }} style={styles.driverAvatar} />
                  ) : (
                    <View style={styles.driverAvatarPlaceholder}>
                      <Ionicons name="person" size={24} color="#fff" />
                    </View>
                  )}
                  <View style={styles.driverDetails}>
                    <Text style={styles.driverName}>
                      {selectedDriver.firstname} {selectedDriver.lastname}
                    </Text>
                    <Text style={styles.driverUsername}>@{selectedDriver.username}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedDriver(null)}>
                  <Ionicons name="close-circle" size={24} color="#dc3545" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => {
                  setShowDriverModal(true);
                  searchDrivers('');
                }}
              >
                <Ionicons name="search-outline" size={20} color={colors.primary} />
                <Text style={styles.selectButtonText}>Search for Driver</Text>
              </TouchableOpacity>
            )}

            {/* Recent Booking Option */}
            {!selectedDriver && (
              <TouchableOpacity
                style={[styles.selectButton, { marginTop: 10 }]}
                onPress={() => {
                  setShowBookingModal(true);
                  fetchRecentBookings();
                }}
              >
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={styles.selectButtonText}>Select from Recent Trips</Text>
              </TouchableOpacity>
            )}

            {/* Tricycle Details (if driver not known) */}
            {!selectedDriver && (
              <View style={styles.tricycleDetails}>
                <Text style={styles.fieldLabel}>Or provide tricycle details:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Plate Number"
                  placeholderTextColor={colors.placeholder}
                  value={tricycleDetails.plateNumber}
                  onChangeText={(text) => setTricycleDetails({ ...tricycleDetails, plateNumber: text })}
                />
                
                {/* Body Number with OCR Scanner */}
                <View style={styles.bodyNumberContainer}>
                  <TextInput
                    style={[styles.input, styles.bodyNumberInput]}
                    placeholder="Body Number (e.g., 0001)"
                    placeholderTextColor={colors.placeholder}
                    value={tricycleDetails.bodyNumber}
                    onChangeText={(text) => setTricycleDetails({ ...tricycleDetails, bodyNumber: text })}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  <View style={styles.bodyNumberButtons}>
                    <TouchableOpacity
                      style={styles.scanButton}
                      onPress={scanBodyNumber}
                      disabled={scanningBodyNumber}
                    >
                      {scanningBodyNumber ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="camera" size={18} color="#fff" />
                          <Text style={styles.scanButtonText}>Scan</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    {tricycleDetails.bodyNumber.length > 0 && (
                      <TouchableOpacity
                        style={styles.lookupButton}
                        onPress={lookupBodyNumber}
                        disabled={scanningBodyNumber}
                      >
                        <Ionicons name="search" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                
                {/* Body Number Detection Result */}
                {bodyNumberDetection && (
                  <View style={styles.detectionResult}>
                    <Ionicons 
                      name={bodyNumberDetection.tricycleMatch ? "checkmark-circle" : "information-circle"} 
                      size={16} 
                      color={bodyNumberDetection.tricycleMatch ? "#28a745" : colors.primary} 
                    />
                    <Text style={[
                      styles.detectionText,
                      { color: bodyNumberDetection.tricycleMatch ? "#28a745" : colors.text }
                    ]}>
                      {bodyNumberDetection.tricycleMatch 
                        ? `Verified: ${bodyNumberDetection.bodyNumber} (${bodyNumberDetection.confidence}%)`
                        : `Detected: ${bodyNumberDetection.bodyNumber} (${bodyNumberDetection.confidence}%)`
                      }
                    </Text>
                  </View>
                )}
                
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Physical description of the tricycle"
                  placeholderTextColor={colors.placeholder}
                  value={tricycleDetails.description}
                  onChangeText={(text) => setTricycleDetails({ ...tricycleDetails, description: text })}
                  multiline
                  numberOfLines={2}
                />
              </View>
            )}
          </View>

          {/* Complaint Category */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="list-outline" size={18} color={colors.primary} /> Complaint Category *
            </Text>
            <View style={styles.categoriesContainer}>
              {categories.map(renderCategoryItem)}
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} /> Description *
            </Text>
            <Text style={styles.sectionSubtitle}>
              Minimum 50 characters ({description.length}/2000)
            </Text>
            <TextInput
              style={[styles.input, styles.textAreaLarge]}
              placeholder="Please provide a detailed description of what happened. Include specific details like time, location, and what was said or done."
              placeholderTextColor={colors.placeholder}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              maxLength={2000}
            />
            {description.length > 0 && description.length < 50 && (
              <Text style={styles.charWarning}>
                {50 - description.length} more characters needed
              </Text>
            )}
            
            {/* Sentiment Analysis Feedback */}
            {analyzingSentiment && (
              <View style={styles.sentimentContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.sentimentAnalyzing}>Analyzing your complaint...</Text>
              </View>
            )}
            
            {sentimentAnalysis && !analyzingSentiment && (
              <View style={[
                styles.sentimentContainer,
                sentimentAnalysis.analysis.urgency === 'critical' && styles.sentimentCritical,
                sentimentAnalysis.analysis.urgency === 'high' && styles.sentimentHigh,
                sentimentAnalysis.analysis.urgency === 'medium' && styles.sentimentMedium,
                sentimentAnalysis.analysis.urgency === 'low' && styles.sentimentLow,
              ]}>
                <View style={styles.sentimentHeader}>
                  <Ionicons 
                    name={
                      sentimentAnalysis.analysis.sentiment === 'negative' ? 'alert-circle' :
                      sentimentAnalysis.analysis.sentiment === 'positive' ? 'information-circle' : 'help-circle'
                    } 
                    size={20} 
                    color={
                      sentimentAnalysis.analysis.urgency === 'critical' ? '#dc3545' :
                      sentimentAnalysis.analysis.urgency === 'high' ? '#fd7e14' :
                      sentimentAnalysis.analysis.urgency === 'medium' ? '#ffc107' : '#28a745'
                    } 
                  />
                  <Text style={styles.sentimentTitle}>AI Analysis</Text>
                  <View style={[
                    styles.urgencyBadge,
                    { backgroundColor: 
                      sentimentAnalysis.analysis.urgency === 'critical' ? '#dc3545' :
                      sentimentAnalysis.analysis.urgency === 'high' ? '#fd7e14' :
                      sentimentAnalysis.analysis.urgency === 'medium' ? '#ffc107' : '#28a745'
                    }
                  ]}>
                    <Text style={styles.urgencyText}>
                      {sentimentAnalysis.analysis.urgency.toUpperCase()}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.sentimentMessage}>{sentimentAnalysis.feedback.message}</Text>
                
                <View style={styles.sentimentStats}>
                  <View style={styles.sentimentStat}>
                    <Text style={styles.sentimentStatLabel}>Quality</Text>
                    <Text style={[
                      styles.sentimentStatValue,
                      { color: sentimentAnalysis.analysis.qualityScore >= 70 ? '#28a745' : 
                               sentimentAnalysis.analysis.qualityScore >= 40 ? '#ffc107' : '#dc3545' }
                    ]}>
                      {sentimentAnalysis.analysis.descriptionQuality === 'good' ? '✓ Good' :
                       sentimentAnalysis.analysis.descriptionQuality === 'fair' ? '◐ Fair' : '✗ Needs Work'}
                    </Text>
                  </View>
                  <View style={styles.sentimentStat}>
                    <Text style={styles.sentimentStatLabel}>Severity</Text>
                    <Text style={styles.sentimentStatValue}>
                      {sentimentAnalysis.analysis.severityScore.toFixed(1)}/5
                    </Text>
                  </View>
                  <View style={styles.sentimentStat}>
                    <Text style={styles.sentimentStatLabel}>Confidence</Text>
                    <Text style={styles.sentimentStatValue}>
                      {sentimentAnalysis.analysis.confidence}%
                    </Text>
                  </View>
                </View>
                
                {sentimentAnalysis.flags.willBePrioritized && (
                  <View style={styles.priorityNote}>
                    <Ionicons name="flash" size={14} color="#dc3545" />
                    <Text style={styles.priorityNoteText}>Uunahin ang iyong reklamo / This complaint will be prioritized</Text>
                  </View>
                )}
                
                {/* Show detected Taglish indicator */}
                {sentimentAnalysis.analysis.isTaglish && (
                  <View style={styles.taglishBadge}>
                    <Ionicons name="language" size={14} color="#6c757d" />
                    <Text style={styles.taglishBadgeText}>Taglish detected / Nakita ang Taglish</Text>
                  </View>
                )}
                
                {sentimentAnalysis.feedback.suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>Mga Suhestiyon / Suggestions:</Text>
                    {sentimentAnalysis.feedback.suggestions.map((suggestion, index) => (
                      <Text key={index} style={styles.suggestionItem}>• {suggestion}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Evidence Upload */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="camera-outline" size={18} color={colors.primary} /> Ebidensya / Evidence (Required) *
            </Text>
            <Text style={styles.sectionSubtitle}>
              Mag-upload ng mga litrato bilang patunay (max 5). Makakatulong ito para i-verify ang iyong reklamo.
            </Text>
            
            <View style={styles.evidenceContainer}>
              {evidence.map((item, index) => (
                <View key={index} style={styles.evidenceItem}>
                  <Image source={{ uri: item.preview }} style={styles.evidenceImage} />
                  <TouchableOpacity
                    style={styles.removeEvidence}
                    onPress={() => removeEvidence(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#dc3545" />
                  </TouchableOpacity>
                </View>
              ))}
              
              {evidence.length < 5 && (
                <View style={styles.uploadButtons}>
                  <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
                    <Ionicons name="camera" size={28} color={colors.primary} />
                    <Text style={styles.uploadButtonText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                    <Ionicons name="images" size={28} color={colors.primary} />
                    <Text style={styles.uploadButtonText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Incident Date */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} /> Incident Date *
            </Text>
            <Text style={styles.sectionSubtitle}>When did this incident occur? (Within the last 7 days)</Text>
            <View style={styles.dateContainer}>
              <Text style={styles.dateText}>{formatDate(incidentDate)}</Text>
              <Text style={styles.dateNote}>
                Note: Only incidents within the last 7 days can be reported.
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="send-outline" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Complaint</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpacing} />
        </>
      )}
    </ScrollView>
  );

  // Render complaint history
  const renderHistory = () => (
    <View style={styles.historyContainer}>
      {loadingComplaints ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading complaints...</Text>
        </View>
      ) : myComplaints.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No complaints filed yet</Text>
        </View>
      ) : (
        <FlatList
          data={myComplaints}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.complaintCard}
              onPress={() => {
                setSelectedComplaint(item);
                setShowComplaintDetail(true);
              }}
            >
              <View style={styles.complaintHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
                </View>
                <Text style={styles.complaintDate}>{formatDate(item.createdAt)}</Text>
              </View>
              
              <View style={styles.complaintBody}>
                <Text style={styles.complaintCategory}>
                  {categories.find(c => c.value === item.category)?.label || item.category}
                </Text>
                {item.driver && (
                  <Text style={styles.complaintDriver}>
                    Against: {item.driver.firstname} {item.driver.lastname}
                  </Text>
                )}
                <Text style={styles.complaintDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
              
              <View style={styles.complaintFooter}>
                <View style={styles.evidenceCount}>
                  <Ionicons name="images-outline" size={16} color="#666" />
                  <Text style={styles.evidenceCountText}>{item.evidence?.length || 0} evidence</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={styles.historyList}
        />
      )}
    </View>
  );

  // Render driver search modal
  const renderDriverModal = () => (
    <Modal
      visible={showDriverModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDriverModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Driver</Text>
            <TouchableOpacity onPress={() => setShowDriverModal(false)}>
              <Ionicons name="close" size={24} color={colors.orangeShade7} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or username"
              placeholderTextColor={colors.placeholder}
              value={driverSearch}
              onChangeText={(text) => {
                setDriverSearch(text);
                searchDrivers(text);
              }}
            />
          </View>
          
          {loadingDrivers ? (
            <ActivityIndicator style={styles.modalLoader} color={colors.primary} />
          ) : (
            <FlatList
              data={drivers}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.driverItem}
                  onPress={() => {
                    setSelectedDriver(item);
                    setShowDriverModal(false);
                  }}
                >
                  {item.image?.url ? (
                    <Image source={{ uri: item.image.url }} style={styles.driverItemAvatar} />
                  ) : (
                    <View style={styles.driverItemAvatarPlaceholder}>
                      <Ionicons name="person" size={20} color="#fff" />
                    </View>
                  )}
                  <View style={styles.driverItemInfo}>
                    <Text style={styles.driverItemName}>
                      {item.firstname} {item.lastname}
                    </Text>
                    <Text style={styles.driverItemUsername}>@{item.username}</Text>
                  </View>
                  {item.rating > 0 && (
                    <View style={styles.driverItemRating}>
                      <Ionicons name="star" size={14} color="#FFB800" />
                      <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptySearchContainer}>
                  <Text style={styles.emptySearchText}>
                    {driverSearch ? 'No drivers found' : 'Type to search for drivers'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );

  // Render booking selection modal
  const renderBookingModal = () => (
    <Modal
      visible={showBookingModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowBookingModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Recent Trips (Last 7 Days)</Text>
            <TouchableOpacity onPress={() => setShowBookingModal(false)}>
              <Ionicons name="close" size={24} color={colors.orangeShade7} />
            </TouchableOpacity>
          </View>
          
          {loadingBookings ? (
            <ActivityIndicator style={styles.modalLoader} color={colors.primary} />
          ) : (
            <FlatList
              data={recentBookings}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.bookingItem}
                  onPress={() => {
                    setSelectedBooking(item);
                    if (item.driver) {
                      setSelectedDriver(item.driver);
                    }
                    setShowBookingModal(false);
                  }}
                >
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingDriver}>
                      {item.driver?.firstname || 'Unknown'} {item.driver?.lastname || 'Driver'}
                    </Text>
                    <Text style={styles.bookingRoute} numberOfLines={1}>
                      {item.pickup?.address || 'Unknown'} → {item.destination?.address || 'Unknown'}
                    </Text>
                    <Text style={styles.bookingDate}>{formatDate(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.bookingFare}>₱{item.agreedFare || '—'}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptySearchContainer}>
                  <Text style={styles.emptySearchText}>No recent trips found</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );

  // Render complaint detail modal
  const renderComplaintDetailModal = () => (
    <Modal
      visible={showComplaintDetail}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowComplaintDetail(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.detailModal]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Complaint Details</Text>
            <TouchableOpacity onPress={() => setShowComplaintDetail(false)}>
              <Ionicons name="close" size={24} color={colors.orangeShade7} />
            </TouchableOpacity>
          </View>
          
          {selectedComplaint && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.statusBadge, { 
                backgroundColor: getStatusColor(selectedComplaint.status),
                alignSelf: 'flex-start',
                marginBottom: 15,
              }]}>
                <Text style={styles.statusText}>{getStatusLabel(selectedComplaint.status)}</Text>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>
                  {categories.find(c => c.value === selectedComplaint.category)?.label || selectedComplaint.category}
                </Text>
              </View>
              
              {selectedComplaint.driver && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Driver</Text>
                  <Text style={styles.detailValue}>
                    {selectedComplaint.driver.firstname} {selectedComplaint.driver.lastname}
                  </Text>
                </View>
              )}
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailDescription}>{selectedComplaint.description}</Text>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Evidence ({selectedComplaint.evidence?.length || 0})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedComplaint.evidence?.map((item, index) => (
                    <Image key={index} source={{ uri: item.url }} style={styles.detailEvidence} />
                  ))}
                </ScrollView>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Filed On</Text>
                <Text style={styles.detailValue}>{formatDate(selectedComplaint.createdAt)}</Text>
              </View>
              
              {selectedComplaint.resolution?.action && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Resolution</Text>
                  <Text style={styles.detailValue}>{selectedComplaint.resolution.action.replace(/_/g, ' ')}</Text>
                  {selectedComplaint.resolution.details && (
                    <Text style={styles.detailDescription}>{selectedComplaint.resolution.details}</Text>
                  )}
                </View>
              )}
              
              {selectedComplaint.status === 'pending' && (
                <TouchableOpacity
                  style={styles.withdrawButton}
                  onPress={() => handleWithdraw(selectedComplaint._id)}
                >
                  <Text style={styles.withdrawButtonText}>Withdraw Complaint</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  // Main render
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Driver Complaints</Text>
        <Text style={styles.headerSubtitle}>File and track complaints against drivers</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeView === 'file' && styles.tabActive]}
          onPress={() => setActiveView('file')}
        >
          <Ionicons 
            name="create-outline" 
            size={20} 
            color={activeView === 'file' ? colors.primary : '#666'} 
          />
          <Text style={[styles.tabText, activeView === 'file' && styles.tabTextActive]}>
            File Complaint
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeView === 'history' && styles.tabActive]}
          onPress={() => setActiveView('history')}
        >
          <Ionicons 
            name="list-outline" 
            size={20} 
            color={activeView === 'history' ? colors.primary : '#666'} 
          />
          <Text style={[styles.tabText, activeView === 'history' && styles.tabTextActive]}>
            My Complaints
          </Text>
          {myComplaints.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{myComplaints.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeView === 'file' ? renderFileForm() : renderHistory()}

      {/* Modals */}
      {renderDriverModal()}
      {renderBookingModal()}
      {renderComplaintDetailModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory1,
  },
  header: {
    padding: spacing.medium,
    backgroundColor: colors.primary,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  formContainer: {
    flex: 1,
    padding: spacing.medium,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8d7da',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#721c24',
    marginLeft: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.ivory3,
    borderStyle: 'dashed',
    gap: 8,
  },
  selectButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },
  selectedDriverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  driverAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverDetails: {
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  driverUsername: {
    fontSize: 13,
    color: '#666',
  },
  tricycleDetails: {
    marginTop: 15,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.ivory3,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: colors.orangeShade7,
    marginBottom: 10,
  },
  // Body Number OCR Scanner Styles
  bodyNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  bodyNumberInput: {
    flex: 1,
    marginBottom: 0,
  },
  bodyNumberButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  scanButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 80,
    justifyContent: 'center',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  lookupButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detectionResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  detectionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  textAreaLarge: {
    height: 150,
    textAlignVertical: 'top',
  },
  charWarning: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 4,
  },
  // Sentiment Analysis Styles
  sentimentContainer: {
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sentimentCritical: {
    backgroundColor: '#fff5f5',
    borderColor: '#dc3545',
  },
  sentimentHigh: {
    backgroundColor: '#fff8f0',
    borderColor: '#fd7e14',
  },
  sentimentMedium: {
    backgroundColor: '#fffbeb',
    borderColor: '#ffc107',
  },
  sentimentLow: {
    backgroundColor: '#f0fff4',
    borderColor: '#28a745',
  },
  sentimentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sentimentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeShade7,
    marginLeft: 6,
    flex: 1,
  },
  sentimentAnalyzing: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  sentimentMessage: {
    fontSize: 13,
    color: '#555',
    marginBottom: 10,
    lineHeight: 18,
  },
  sentimentStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  sentimentStat: {
    alignItems: 'center',
  },
  sentimentStatLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
  },
  sentimentStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  priorityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff5f5',
    borderRadius: 6,
  },
  priorityNoteText: {
    fontSize: 12,
    color: '#dc3545',
    marginLeft: 6,
    fontWeight: '500',
  },
  taglishBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 6,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  taglishBadgeText: {
    fontSize: 11,
    color: '#6c757d',
    marginLeft: 4,
  },
  suggestionsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  suggestionItem: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
    paddingLeft: 4,
  },
  categoriesContainer: {
    gap: 10,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  categoryItemSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 140, 0, 0.05)',
  },
  categoryContent: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.orangeShade7,
  },
  categoryLabelSelected: {
    color: colors.primary,
  },
  categoryDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  evidenceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  evidenceItem: {
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
  },
  removeEvidence: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadButton: {
    width: 100,
    height: 100,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.ivory3,
    borderStyle: 'dashed',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },
  dateContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  dateText: {
    fontSize: 15,
    color: colors.orangeShade7,
    fontWeight: '500',
  },
  dateNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  bottomSpacing: {
    height: 30,
  },
  historyContainer: {
    flex: 1,
  },
  historyList: {
    padding: spacing.medium,
  },
  complaintCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.ivory3,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  complaintDate: {
    fontSize: 12,
    color: '#666',
  },
  complaintBody: {
    marginBottom: 10,
  },
  complaintCategory: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  complaintDriver: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  complaintDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
    lineHeight: 18,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.ivory3,
  },
  evidenceCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  evidenceCountText: {
    fontSize: 12,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  detailModal: {
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.orangeShade7,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory2,
    margin: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    color: colors.orangeShade7,
  },
  modalLoader: {
    paddingVertical: 40,
  },
  driverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  driverItemAvatar: {
    width: 45,
    height: 45,
    borderRadius: 23,
  },
  driverItemAvatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.orangeShade7,
  },
  driverItemUsername: {
    fontSize: 13,
    color: '#666',
  },
  driverItemRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    color: '#666',
  },
  emptySearchContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 14,
    color: '#999',
  },
  bookingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.ivory3,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingDriver: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.orangeShade7,
  },
  bookingRoute: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  bookingDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  bookingFare: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  detailSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.orangeShade7,
  },
  detailDescription: {
    fontSize: 14,
    color: colors.orangeShade7,
    lineHeight: 20,
  },
  detailEvidence: {
    width: 120,
    height: 120,
    borderRadius: 10,
    marginRight: 10,
  },
  withdrawButton: {
    backgroundColor: '#dc3545',
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ComplaintScreen;

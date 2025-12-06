import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Modal, 
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

// Import the signupUser thunk from Redux actions
import { signupUser } from '../../redux/actions/authAction';
// Import theme
import { colors, spacing } from '../../components/common/theme';

const Signup = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  // API URL
  const { extra: { BACKEND_URL } = {} } = Constants.expoConfig;
  const apiURL = BACKEND_URL || 'http://192.168.254.105:5000';

  // Form field references for focus navigation
  const firstnameRef = useRef(null);
  const lastnameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const phoneRef = useRef(null);
  const streetRef = useRef(null);
  const cityRef = useRef(null);
  const postalCodeRef = useRef(null);

  // Basic signup fields
  const [username, setUsername] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Additional fields
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Philippines');
  const [role, setRole] = useState('driver'); // driver or operator

  // Photo upload state
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  
  // Form validation
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    // Required fields validation
    if (!username.trim()) newErrors.username = 'Username is required';
    if (username.length > 30) newErrors.username = 'Username cannot exceed 30 characters';
    
    if (!firstname.trim()) newErrors.firstname = 'First name is required';
    if (firstname.length > 30) newErrors.firstname = 'First name cannot exceed 30 characters';
    
    if (!lastname.trim()) newErrors.lastname = 'Last name is required';
    if (lastname.length > 30) newErrors.lastname = 'Last name cannot exceed 30 characters';
    
    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    // Password validation
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    // Confirm password
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    // Phone validation - optional but if provided, must be 11 digits
    if (phone && !/^\d{11}$/.test(phone)) {
      newErrors.phone = 'Phone must be 11 digits';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors in the form');
      return;
    }

    setIsSubmitting(true);

    // Create an address object from the fields (all optional)
    const address = { 
      street: street || undefined, 
      city: city || undefined, 
      postalCode: postalCode || undefined, 
      country 
    };

    // Dispatch signup action
    dispatch(signupUser({ 
      username, 
      firstname, 
      lastname, 
      email, 
      password, 
      address, 
      phone: phone || undefined,
      role,
      image: capturedPhoto ? { url: capturedPhoto } : undefined
    }))
      .unwrap()
      .then((user) => {
        console.log('Signup successful:', user);
        Alert.alert(
          'Welcome to TricycleMOD!', 
          'Account created successfully. Please log in with your credentials.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      })
      .catch((error) => {
        console.error('Signup error:', error);
        Alert.alert('Signup Failed', typeof error === 'string' ? error : 'An error occurred during signup. Please try again.');
      })
      .finally(() => setIsSubmitting(false));
  };

  // Functions for image picking
  const pickImageFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Denied", "You need to allow access to your gallery.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setCapturedPhoto(uri);
      setModalVisible(false);
    }
  };

  const takePhotoWithCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Denied", "You need to allow access to your camera.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setCapturedPhoto(uri);
      setModalVisible(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={styles.logo}>TricycleMOD</Text>
          <Text style={styles.subtitle}>Create Your Account</Text>
        </View>

        {/* Basic Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username*</Text>
            <TextInput
              style={[styles.input, errors.username && styles.inputError]}
              placeholder="Choose a username"
              placeholderTextColor={colors.placeholder}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => firstnameRef.current?.focus()}
            />
            {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
          </View>

          <View style={styles.rowContainer}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>First Name*</Text>
              <TextInput
                ref={firstnameRef}
                style={[styles.input, errors.firstname && styles.inputError]}
                placeholder="First name"
                placeholderTextColor={colors.placeholder}
                value={firstname}
                onChangeText={setFirstname}
                returnKeyType="next"
                onSubmitEditing={() => lastnameRef.current?.focus()}
              />
              {errors.firstname && <Text style={styles.errorText}>{errors.firstname}</Text>}
            </View>
            
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Last Name*</Text>
              <TextInput
                ref={lastnameRef}
                style={[styles.input, errors.lastname && styles.inputError]}
                placeholder="Last name"
                placeholderTextColor={colors.placeholder}
                value={lastname}
                onChangeText={setLastname}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
              {errors.lastname && <Text style={styles.errorText}>{errors.lastname}</Text>}
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email*</Text>
            <TextInput
              ref={emailRef}
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="Your email address"
              placeholderTextColor={colors.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password*</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                ref={passwordRef}
                style={[styles.passwordInput, errors.password && styles.inputError]}
                placeholder="Create a password (min 6 characters)"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              />
              <TouchableOpacity 
                style={styles.eyeIcon} 
                onPress={() => setPasswordVisible(!passwordVisible)}
              >
                <Ionicons 
                  name={passwordVisible ? "eye-off" : "eye"} 
                  size={24} 
                  color={colors.text} 
                />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password*</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                ref={confirmPasswordRef}
                style={[styles.passwordInput, errors.confirmPassword && styles.inputError]}
                placeholder="Confirm your password"
                placeholderTextColor={colors.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!confirmPasswordVisible}
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
              <TouchableOpacity 
                style={styles.eyeIcon} 
                onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
              >
                <Ionicons 
                  name={confirmPasswordVisible ? "eye-off" : "eye"} 
                  size={24} 
                  color={colors.text} 
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Role*</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={role}
                onValueChange={(itemValue) => setRole(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Driver" value="driver" />
                <Picker.Item label="Operator" value="operator" />
              </Picker>
            </View>
          </View>
        </View>

        {/* Contact Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information (Optional)</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              ref={phoneRef}
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="11-digit phone number"
              placeholderTextColor={colors.placeholder}
              value={phone}
              onChangeText={(text) => {
                // Allow only numbers
                const cleaned = text.replace(/[^0-9]/g, '');
                setPhone(cleaned);
              }}
              keyboardType="phone-pad"
              maxLength={11}
              returnKeyType="next"
              onSubmitEditing={() => streetRef.current?.focus()}
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>
        </View>

        {/* Address Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address Information (Optional)</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Street Address</Text>
            <TextInput
              ref={streetRef}
              style={styles.input}
              placeholder="Street address"
              placeholderTextColor={colors.placeholder}
              value={street}
              onChangeText={setStreet}
              returnKeyType="next"
              onSubmitEditing={() => cityRef.current?.focus()}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>City</Text>
            <TextInput
              ref={cityRef}
              style={styles.input}
              placeholder="City"
              placeholderTextColor={colors.placeholder}
              value={city}
              onChangeText={setCity}
              returnKeyType="next"
              onSubmitEditing={() => postalCodeRef.current?.focus()}
            />
          </View>

          <View style={styles.rowContainer}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Postal Code</Text>
              <TextInput
                ref={postalCodeRef}
                style={styles.input}
                placeholder="4-digit code"
                placeholderTextColor={colors.placeholder}
                value={postalCode}
                onChangeText={(text) => {
                  // Allow only numbers
                  const cleaned = text.replace(/[^0-9]/g, '');
                  setPostalCode(cleaned);
                }}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Country</Text>
              <TextInput
                style={styles.input}
                placeholder="Philippines"
                placeholderTextColor={colors.placeholder}
                value={country}
                onChangeText={setCountry}
                editable={false}
              />
            </View>
          </View>
        </View>

        {/* Photo Upload Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Photo (Optional)</Text>
          
          <View style={styles.photoSection}>
            {capturedPhoto ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: capturedPhoto }} style={styles.photoPreview} />
              </View>
            ) : (
              <View style={styles.placeholderContainer}>
                <Ionicons name="person-circle-outline" size={80} color={colors.orangeShade4} />
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.photoButton} 
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.photoButtonText}>
                {capturedPhoto ? "Change Photo" : "Upload Photo"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Signup Button */}
        <TouchableOpacity 
          style={styles.signupButton} 
          onPress={handleSignup}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signupButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Already have account */}
        <TouchableOpacity 
          style={styles.loginLinkContainer} 
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.loginLink}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal for image picker options */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upload Profile Photo</Text>
            
            <TouchableOpacity style={styles.modalButton} onPress={takePhotoWithCamera}>
              <Ionicons name="camera-outline" size={22} color="#fff" style={styles.modalButtonIcon} />
              <Text style={styles.modalButtonText}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalButton} onPress={pickImageFromGallery}>
              <Ionicons name="images-outline" size={22} color="#fff" style={styles.modalButtonIcon} />
              <Text style={styles.modalButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.medium,
  },
  headerContainer: {
    alignItems: 'center',
    marginVertical: spacing.large,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.small,
  },
  subtitle: {
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.medium,
  },
  section: {
    marginBottom: spacing.large,
    backgroundColor: colors.ivory4,
    borderRadius: 12,
    padding: spacing.medium,
    borderWidth: 1,
    borderColor: colors.orangeShade3 + '40',
    shadowColor: colors.orangeShade6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.orangeShade5,
    marginBottom: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.orangeShade2 + '30',
    paddingBottom: 8,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputContainer: {
    marginBottom: spacing.medium,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.orangeShade6,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.ivory1,
    borderWidth: 1,
    borderColor: colors.orangeShade2 + '60',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 1,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory1,
    borderWidth: 1,
    borderColor: colors.orangeShade2 + '60',
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  eyeIcon: {
    padding: 10,
  },
  pickerContainer: {
    backgroundColor: colors.ivory1,
    borderWidth: 1,
    borderColor: colors.orangeShade2 + '60',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: colors.text,
  },
  photoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.medium,
  },
  photoPreviewContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: spacing.medium,
    borderWidth: 3,
    borderColor: colors.orangeShade3,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.ivory2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: colors.orangeShade3 + '40',
  },
  photoButton: {
    backgroundColor: colors.orangeShade4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
  },
  photoButtonText: {
    color: colors.ivory1,
    fontSize: 14,
    fontWeight: '500',
  },
  signupButton: {
    backgroundColor: colors.orangeShade3,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: spacing.medium,
    shadowColor: colors.orangeShade8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  signupButtonText: {
    color: colors.ivory1,
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginLinkContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  loginLinkText: {
    color: colors.text,
    fontSize: 14,
  },
  loginLink: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.ivory1,
    padding: spacing.large,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.orangeShade5,
    marginBottom: spacing.large,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: colors.orangeShade3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: spacing.medium,
  },
  modalButtonIcon: {
    marginRight: 8,
  },
  modalButtonText: {
    color: colors.ivory1,
    fontSize: 16,
    fontWeight: '500',
  },
  modalCancelButton: {
    padding: 15,
    borderRadius: 10,
    marginTop: spacing.small,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.orangeShade3,
  },
  modalCancelButtonText: {
    color: colors.orangeShade5,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default Signup;
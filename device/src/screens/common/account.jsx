import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  View, 
  ActivityIndicator, 
  TouchableOpacity, 
  Text, 
  Modal,
  Alert,
  StatusBar,
  Image
} from 'react-native';
import { Card, Title, Paragraph, Avatar, Button, TextInput, Divider } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { fetchCurrentUser, updateProfile } from '../../redux/actions/userAction';
import { logoutUser } from '../../redux/actions/authAction';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import Toasthelper from '../../components/common/toasthelper';
import { colors, spacing, fonts } from '../../components/common/theme';
import * as ImagePicker from "expo-image-picker";
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

const Account = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const db = useAsyncSQLiteContext();
  const { currentUser, loading, error } = useSelector(state => state.user);

  // Local state for edit mode and profile fields
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState({
    userId: '',
    firstname: '',
    lastname: '',
    email: '',
    address: { street: '', city: '', postalCode: '', country: 'Philippines' },
    phone: '',
    image: {}
  });
  
  // State for photo integration using ImagePicker
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  useEffect(() => {
    if (currentUser) {
      setEditedUser({
        _id: currentUser._id,
        firstname: currentUser.firstname || '',
        lastname: currentUser.lastname || '',
        email: currentUser.email || '',
        address: currentUser.address || { street: '', city: '', postalCode: '', country: 'Philippines' },
        phone: currentUser.phone || '',
        image: currentUser.image || {}
      });
    }
  }, [currentUser]);

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout", 
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          onPress: () => {
            dispatch(logoutUser(db))
              .unwrap()
              .then(() => {
                Toasthelper.showSuccess('Logout Successful');
                navigation.navigate('Login');
              })
              .catch((error) => {
                Toasthelper.showError('Logout Failed', error.message);
              });
          }
        }
      ]
    );
  };

  const handleEditProfile = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (currentUser) {
      setEditedUser({
        _id: currentUser._id,
        firstname: currentUser.firstname || '',
        lastname: currentUser.lastname || '',
        email: currentUser.email || '',
        address: currentUser.address || { street: '', city: '', postalCode: '', country: 'Philippines' },
        phone: currentUser.phone || '',
        image: currentUser.image || {}
      });
      setCapturedPhoto(null);
    }
    setIsEditing(false);
    setModalVisible(false);
  };

  const handleSaveProfile = () => {
    dispatch(updateProfile({ db, user: editedUser }))
      .unwrap()
      .then((updatedUser) => {
        Toasthelper.showSuccess('Profile updated successfully');
        setIsEditing(false);
        setCapturedPhoto(null);
      })
      .catch((error) => {
        Toasthelper.showError('Profile update failed', error.message);
      });
  };

  // Use ImagePicker to launch the gallery
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
      setEditedUser(prev => ({ ...prev, image: { url: uri } }));
      setModalVisible(false);
    }
  };

  // Use ImagePicker to launch the camera
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
      setEditedUser(prev => ({ ...prev, image: { url: uri } }));
      setModalVisible(false);
    }
  };

  const renderAddress = () => {
    const { address } = currentUser;
    if (address && typeof address === 'object' && Object.keys(address).length > 0) {
      return (
        <>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="location-on" size={20} color={colors.primary} />
            <Title style={styles.sectionTitle}>Address</Title>
          </View>
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>{address.street || 'N/A'}</Text>
            <Text style={styles.infoText}>{address.city || 'N/A'}</Text>
            <Text style={styles.infoText}>{address.postalCode || 'N/A'}</Text>
            <Text style={styles.infoText}>{address.country || 'Philippines'}</Text>
          </View>
        </>
      );
    }
    return (
      <>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="location-on" size={20} color={colors.primary} />
          <Title style={styles.sectionTitle}>Address</Title>
        </View>
        <Text style={styles.emptyText}>No address available.</Text>
      </>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <MaterialIcons name="error-outline" size={60} color={colors.error} />
        <Text style={styles.errorText}>Error: {error}</Text>
        <Button 
          mode="contained" 
          onPress={() => dispatch(fetchCurrentUser())}
          style={styles.retryButton}
          labelStyle={styles.buttonText}
        >
          Retry
        </Button>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <MaterialIcons name="person-outline" size={60} color={colors.orangeShade4} />
        <Text style={styles.noDataText}>No user data available.</Text>
        <Button 
          mode="contained" 
          onPress={() => navigation.navigate('Login')}
          style={styles.loginButton}
          labelStyle={styles.buttonText}
        >
          Go to Login
        </Button>
      </View>
    );
  }

  const { firstname, lastname, username, email, address, image, role, rating, numReviews } = currentUser;

  return (
    <>
      <StatusBar backgroundColor={colors.orangeShade3} barStyle="light-content" />
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        style={styles.container}
      >
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => isEditing && setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Avatar.Image
              size={100}
              source={{
                uri: capturedPhoto || image?.url || 'https://via.placeholder.com/150',
              }}
              style={styles.avatar}
            />
            {isEditing && (
              <View style={styles.editOverlay}>
                <MaterialIcons name="photo-camera" size={24} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.nameContainer}>
            {isEditing ? (
              <>
                <TextInput
                  label="First Name"
                  value={editedUser.firstname}
                  onChangeText={(text) => setEditedUser({ ...editedUser, firstname: text })}
                  style={styles.nameInput}
                  theme={{ colors: { primary: colors.primary } }}
                  maxLength={30}
                />
                <TextInput
                  label="Last Name"
                  value={editedUser.lastname}
                  onChangeText={(text) => setEditedUser({ ...editedUser, lastname: text })}
                  style={styles.nameInput}
                  theme={{ colors: { primary: colors.primary } }}
                  maxLength={30}
                />
              </>
            ) : (
              <>
                <Text style={styles.nameText}>{firstname} {lastname}</Text>
                <Text style={styles.usernameText}>@{username}</Text>
                <View style={styles.roleContainer}>
                  <Ionicons 
                    name={role === 'driver' ? 'car-sport' : 'briefcase'} 
                    size={16} 
                    color={colors.orangeShade5} 
                  />
                  <Text style={styles.roleText}>{role === 'driver' ? 'Driver' : 'Operator'}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Rating Section - Display Only */}
        {!isEditing && (
          <Card style={styles.ratingCard}>
            <Card.Content>
              <View style={styles.ratingContainer}>
                <View style={styles.ratingItem}>
                  <Ionicons name="star" size={24} color={colors.starYellow} />
                  <Text style={styles.ratingValue}>{rating?.toFixed(1) || '0.0'}</Text>
                  <Text style={styles.ratingLabel}>Rating</Text>
                </View>
                <Divider style={styles.verticalDivider} />
                <View style={styles.ratingItem}>
                  <Ionicons name="chatbox" size={24} color={colors.orangeShade4} />
                  <Text style={styles.ratingValue}>{numReviews || 0}</Text>
                  <Text style={styles.ratingLabel}>Reviews</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        <Card style={styles.contentCard}>
          <Card.Content>
            {isEditing ? (
              <View style={styles.editForm}>
                <TextInput
                  label="Email"
                  value={editedUser.email}
                  onChangeText={(text) => setEditedUser({ ...editedUser, email: text })}
                  style={styles.input}
                  theme={{ colors: { primary: colors.primary } }}
                  left={<TextInput.Icon icon="email" color={colors.orangeShade4} />}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                
                <TextInput
                  label="Phone"
                  value={editedUser.phone}
                  onChangeText={(text) => {
                    // Allow only numbers
                    const cleaned = text.replace(/[^0-9]/g, '');
                    setEditedUser({ ...editedUser, phone: cleaned });
                  }}
                  style={styles.input}
                  theme={{ colors: { primary: colors.primary } }}
                  left={<TextInput.Icon icon="phone" color={colors.orangeShade4} />}
                  keyboardType="phone-pad"
                  maxLength={11}
                  placeholder="11-digit phone number"
                />

                <Text style={styles.sectionLabel}>Address Information</Text>
                
                <TextInput
                  label="Street Address"
                  value={editedUser.address.street}
                  onChangeText={(text) =>
                    setEditedUser({ 
                      ...editedUser, 
                      address: { ...editedUser.address, street: text } 
                    })
                  }
                  style={styles.input}
                  theme={{ colors: { primary: colors.primary } }}
                  left={<TextInput.Icon icon="map-marker" color={colors.orangeShade4} />}
                />
                
                <View style={styles.rowInputs}>
                  <TextInput
                    label="City"
                    value={editedUser.address.city}
                    onChangeText={(text) =>
                      setEditedUser({ 
                        ...editedUser, 
                        address: { ...editedUser.address, city: text } 
                      })
                    }
                    style={[styles.input, styles.halfInput]}
                    theme={{ colors: { primary: colors.primary } }}
                  />
                  
                  <TextInput
                    label="Postal Code"
                    value={editedUser.address.postalCode}
                    onChangeText={(text) => {
                      // Allow only numbers, max 4 digits
                      const cleaned = text.replace(/[^0-9]/g, '');
                      setEditedUser({ 
                        ...editedUser, 
                        address: { ...editedUser.address, postalCode: cleaned } 
                      });
                    }}
                    style={[styles.input, styles.halfInput]}
                    theme={{ colors: { primary: colors.primary } }}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
                
                <TextInput
                  label="Country"
                  value={editedUser.address.country}
                  onChangeText={(text) =>
                    setEditedUser({ 
                      ...editedUser, 
                      address: { ...editedUser.address, country: text } 
                    })
                  }
                  style={styles.input}
                  theme={{ colors: { primary: colors.primary } }}
                />
              </View>
            ) : (
              // View mode
              <View>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="account-circle" size={20} color={colors.primary} />
                  <Title style={styles.sectionTitle}>Account Information</Title>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Username:</Text>
                  <Text style={styles.infoText}>@{username}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Role:</Text>
                  <Text style={styles.infoText}>{role === 'driver' ? 'Driver' : 'Operator'}</Text>
                </View>
                
                <Divider style={styles.divider} />
                
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="email" size={20} color={colors.primary} />
                  <Title style={styles.sectionTitle}>Email</Title>
                </View>
                <Text style={styles.infoText}>{email}</Text>
                
                <Divider style={styles.divider} />
                
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="phone" size={20} color={colors.primary} />
                  <Title style={styles.sectionTitle}>Phone</Title>
                </View>
                <Text style={styles.infoText}>{currentUser.phone || 'No phone number added'}</Text>
                
                <Divider style={styles.divider} />
                
                {renderAddress()}
              </View>
            )}
          </Card.Content>
        </Card>

        <View style={styles.actionsContainer}>
          {isEditing ? (
            <View style={styles.editButtonsContainer}>
              <Button
                mode="contained"
                onPress={handleSaveProfile}
                style={styles.saveButton}
                labelStyle={styles.buttonText}
                icon="content-save"
              >
                Save Profile
              </Button>
              <Button
                mode="outlined"
                onPress={handleCancelEdit}
                style={styles.cancelButton}
                labelStyle={styles.cancelButtonText}
                icon="close-circle"
              >
                Cancel
              </Button>
            </View>
          ) : (
            <Button 
              mode="contained" 
              onPress={handleEditProfile} 
              style={styles.editButton}
              labelStyle={styles.buttonText}
              icon="account-edit"
            >
              Edit Profile
            </Button>
          )}
          
          <Button 
            mode="outlined" 
            onPress={handleLogout} 
            style={styles.logoutButton} 
            labelStyle={styles.logoutButtonText}
            icon="logout"
          >
            Logout
          </Button>
        </View>

        {/* Modal for image picker options */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Update Profile Photo</Text>
              
              <TouchableOpacity style={styles.modalButton} onPress={takePhotoWithCamera}>
                <MaterialIcons name="camera-alt" size={24} color="#fff" style={styles.modalIcon} />
                <Text style={styles.modalButtonText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalButton} onPress={pickImageFromGallery}>
                <MaterialIcons name="photo-library" size={24} color="#fff" style={styles.modalIcon} />
                <Text style={styles.modalButtonText}>Choose from Gallery</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </>
  );
};

export default Account;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.medium,
    paddingBottom: spacing.large * 2,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.medium,
    color: colors.orangeShade5,
    fontSize: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.medium,
    marginTop: spacing.large,
    backgroundColor: colors.ivory3,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    backgroundColor: colors.ivory6,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  editOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.orangeShade4,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameContainer: {
    flex: 1,
    marginLeft: spacing.medium,
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.orangeShade6,
    marginBottom: 4,
  },
  usernameText: {
    fontSize: 16,
    color: colors.orangeShade4,
    marginBottom: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  roleText: {
    fontSize: 14,
    color: colors.orangeShade5,
    marginLeft: 4,
    fontWeight: '500',
  },
  nameInput: {
    backgroundColor: colors.ivory2,
    marginBottom: 8,
  },
  ratingCard: {
    marginTop: spacing.large,
    backgroundColor: colors.ivory2,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.small,
  },
  ratingItem: {
    alignItems: 'center',
    flex: 1,
  },
  ratingValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.orangeShade6,
    marginTop: 4,
  },
  ratingLabel: {
    fontSize: 12,
    color: colors.orangeShade4,
    marginTop: 2,
  },
  verticalDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.orangeShade2,
    opacity: 0.3,
  },
  contentCard: {
    marginTop: spacing.large,
    backgroundColor: colors.ivory2,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.medium,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.orangeShade5,
    marginLeft: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.orangeShade5,
    marginTop: spacing.medium,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 28,
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.orangeShade4,
    fontWeight: '500',
  },
  infoText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 28,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 16,
    color: colors.orangeShade4,
    fontStyle: 'italic',
    marginLeft: 28,
    marginTop: 4,
  },
  infoContainer: {
    marginTop: 4,
    marginBottom: spacing.medium,
  },
  divider: {
    height: 1,
    backgroundColor: colors.orangeShade2,
    opacity: 0.2,
    marginVertical: spacing.medium,
  },
  editForm: {
    marginVertical: spacing.small,
  },
  input: {
    marginBottom: spacing.medium,
    backgroundColor: colors.ivory1,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  actionsContainer: {
    marginTop: spacing.large,
  },
  editButtonsContainer: {
    marginBottom: spacing.medium,
  },
  editButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginBottom: spacing.medium,
    paddingVertical: 8,
  },
  saveButton: {
    backgroundColor: colors.orangeShade3,
    borderRadius: 8,
    marginBottom: spacing.medium,
    paddingVertical: 8,
  },
  cancelButton: {
    borderColor: colors.orangeShade4,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: spacing.medium,
    paddingVertical: 8,
  },
  logoutButton: {
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  cancelButtonText: {
    color: colors.orangeShade6,
    fontSize: 16,
  },
  logoutButtonText: {
    color: colors.error,
    fontSize: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    marginTop: spacing.medium,
    marginBottom: spacing.medium,
    textAlign: 'center',
  },
  noDataText: {
    color: colors.orangeShade4,
    fontSize: 16,
    marginTop: spacing.medium,
    marginBottom: spacing.large,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: spacing.medium,
    paddingVertical: 8,
    width: 150,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: spacing.medium,
    paddingVertical: 8,
    width: 150,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.large,
  },
  modalContent: {
    backgroundColor: colors.ivory1,
    borderRadius: 12,
    padding: spacing.large,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.orangeShade6,
    marginBottom: spacing.large,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: colors.orangeShade3,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: spacing.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIcon: {
    marginRight: 10,
  },
  modalButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  modalCancelButton: {
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: spacing.small,
  },
  modalCancelButtonText: {
    color: colors.orangeShade5,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
});
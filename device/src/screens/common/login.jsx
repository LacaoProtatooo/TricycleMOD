// Login.jsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { useDispatch } from 'react-redux';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../utils/config';

import { auth } from '../../utils/firebaseConfig';
import {
  GoogleSignin,
  GoogleSigninButton,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';

import { loginUser, googleLogin } from '../../redux/actions/authAction';
import { Toasthelper } from '../../components/common/toasthelper';
import { colors, spacing, globalStyles } from '../../components/common/theme';

const Login = () => {
  const dispatch = useDispatch();
  const db = useAsyncSQLiteContext();
  const navigation = useNavigation();

  if (!db) {
    console.warn('Database is not initialized yet.');
  }

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const apiURL = API_URL;

  const navigateAfterLogin = (user) => {
    // Route operators to OperatorScreen, others to Home
    const targetScreen = user?.role === 'operator' ? 'OperatorScreen' : 'Home';
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: user?.isAdmin ? 'Adminhome' : targetScreen }],
      })
    );
  };

  const handleLogin = () => {
    if (!identifier || !password) {
      Toasthelper.showError('Missing Fields', 'Please enter username/email and password');
      return;
    }
    
    setIsSubmitting(true);
    dispatch(loginUser({ email: identifier, password, db }))
      .unwrap()
      .then((user) => {
        Toasthelper.showSuccess('Login Successful');
        console.log('Logged in user:', user);
        navigateAfterLogin(user);
      })
      .catch((error) => {
        console.error('❌ Login failed:', error);
        Toasthelper.showError('Login Failed', typeof error === 'string' ? error : (error?.message || 'Invalid Credentials'));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Sign out first to force account selection (only if user is currently signed in)
      const currentUser = await GoogleSignin.getCurrentUser();
      if (currentUser) {
        await GoogleSignin.signOut();
      }

      // Sign in and get response
      const response = await GoogleSignin.signIn();

      // Validate response
      if (!isSuccessResponse(response)) {
        throw new Error('Google sign-in was not successful');
      }

      // Extract ID token
      const { idToken } = response.data;
      const credential = GoogleAuthProvider.credential(idToken);

      // Sign into Firebase
      const userCredential = await signInWithCredential(auth, credential);

      // Get Firebase auth token
      const firebaseIdToken = await userCredential.user.getIdToken();

      // Send token to backend → Redux
      dispatch(googleLogin({ firebaseIdToken, db }))
        .unwrap()
        .then((user) => {
          Toasthelper.showSuccess('Google Login Successful');
          navigateAfterLogin(user);
        })
        .catch((error) => {
          Toasthelper.showError('Google Login Failed', error.message);
        })
        .finally(() => setIsSubmitting(false));

    } catch (error) {
      console.error('Google sign-in error:', error);
      Toasthelper.showError('Google Sign-In Failed', error.message || 'Authentication failed');
      setIsSubmitting(false);
    }
  };


  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  const goToSignup = () => {
    navigation.navigate('Signup');
  };

  return (
    <KeyboardAvoidingView
      behavior="height"
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>

          <Image
            source={require('../../../assets/webttrac_logo_bgrm.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
       
          <Text style={styles.appName}>WEBT-TRaC</Text>
        </View>

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={colors.bronzeShade6} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username or Email"
              placeholderTextColor={colors.placeholder}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="default"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.bronzeShade6} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={toggleShowPassword} style={styles.eyeIcon}>
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color={colors.bronzeShade6} 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.ivory1} />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.orContainer}>
            <View style={styles.divider} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            <Ionicons name="logo-google" size={20} color={colors.bronzeShade8} style={styles.googleIcon} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity onPress={goToSignup}>
            <Text style={styles.signupLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.large,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.large * 2,
  },
  logoCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.medium,
    elevation: 5,
    shadowColor: colors.bronzeShade8,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.ivory1,
  },
  appName: {
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.bronzeShade7,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.bronzeShade7,
    textAlign: 'center',
    marginBottom: spacing.small,
  },
  subtitle: {
    fontSize: 16,
    color: colors.bronzeShade5,
    textAlign: 'center',
    marginBottom: spacing.large * 1.5,
  },
  formContainer: {
    width: '100%',
    marginBottom: spacing.large,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ivory4,
    borderRadius: 10,
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: colors.ivory6,
    paddingHorizontal: spacing.medium,
    height: 55,
  },
  inputIcon: {
    marginRight: spacing.medium,
  },
  input: {
    flex: 1,
    height: '100%',
    color: colors.text,
    fontSize: 16,
  },
  eyeIcon: {
    padding: spacing.small,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: spacing.large,
  },
  forgotPasswordText: {
    color: colors.bronzeShade6,
    fontSize: 14,
  },
  logoImage: {
    width: 200,
    height: 200,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.large,
    elevation: 3,
    shadowColor: colors.bronzeShade8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  loginButtonText: {
    color: colors.ivory1,
    fontSize: 18,
    fontWeight: 'bold',
  },
  orContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.large,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.bronzeShade3,
  },
  orText: {
    color: colors.bronzeShade6,
    paddingHorizontal: spacing.medium,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: colors.ivory2,
    borderRadius: 10,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.bronzeShade3,
  },
  googleIcon: {
    marginRight: spacing.small,
  },
  googleButtonText: {
    color: colors.bronzeShade8,
    fontSize: 16,
    fontWeight: '500',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.large,
  },
  signupText: {
    color: colors.bronzeShade6,
    fontSize: 16,
  },
  signupLink: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default Login;
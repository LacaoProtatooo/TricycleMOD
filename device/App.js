// App.js
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigator from './src/navigation/navigator';
import store from './src/redux/store';
import { Provider } from 'react-redux';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { AsyncSQLiteProvider } from './src/utils/asyncSQliteProvider';
import { migrateDbIfNeeded } from './src/utils/jwtStorage';
import Toast from 'react-native-toast-message';
import PersistentLogin from './src/utils/persistentLogin';

import NotificationHandler from './src/components/common/NotificationHandler';

GoogleSignin.configure({
  webClientId: '75787064888-l1hip5a66fhr6h7bgoo36okvj8qncm35.apps.googleusercontent.com',
  profileImageSize: 150,
});

export default function App() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <AsyncSQLiteProvider databaseName="tmod.db" onInit={migrateDbIfNeeded}>
          <PersistentLogin />
          <Navigator/>
          <NotificationHandler />
          <Toast />
        </AsyncSQLiteProvider>
      </Provider>
    </SafeAreaProvider>
  );
}

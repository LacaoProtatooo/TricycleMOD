// App.js
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigator from './src/navigation/navigator';
import store from './src/redux/store';
import { Provider } from 'react-redux';

import { AsyncSQLiteProvider } from './src/utils/asyncSQliteProvider';
import { migrateDbIfNeeded } from './src/utils/jwtStorage';
import Toast from 'react-native-toast-message';
import PersistentLogin from './src/utils/persistentLogin';

import NotificationHandler from './src/components/common/NotificationHandler';
export default function App() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <AsyncSQLiteProvider databaseName="tmod.db" onInit={migrateDbIfNeeded}>
          <PersistentLogin />
          <NotificationHandler />
          <Navigator/>
          <Toast />
        </AsyncSQLiteProvider>
      </Provider>
    </SafeAreaProvider>
  );
}

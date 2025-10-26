import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useAsyncSQLiteContext } from '../utils/asyncSQliteProvider';
import { verifyUser, logoutUser } from '../redux/actions/authAction';
import Toasthelper from '../components/common/toasthelper';

const PersistentLogin = () => {
    const db = useAsyncSQLiteContext();
    const dispatch = useDispatch();
    
    useEffect(() => {
      const checkPersistedLogin = async () => {
        if (!db) return; // Wait until the database is available
  
        // Dispatch the verifyUser thunk to check token validity with the backend
        const resultAction = await dispatch(verifyUser({ db }));
        if (verifyUser.fulfilled.match(resultAction)) {
          console.log('User verified persistently:', resultAction.payload);
        } else {
          console.log('Persistent login failed:', resultAction.payload);
          logoutUser(db);
          Toasthelper.showError('Session Expired', 'Please log in again.');
        }
      };
  
      checkPersistedLogin();
    }, [db, dispatch]);
  
    return null;
  };
  
  export default PersistentLogin;

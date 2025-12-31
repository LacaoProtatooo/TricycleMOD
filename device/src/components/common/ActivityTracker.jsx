import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { sendHeartbeat, markUserOffline } from '../../redux/actions/activityAction';
import { resetActivity } from '../../redux/reducers/activityReducer';
import { useAsyncSQLiteContext } from '../../utils/asyncSQliteProvider';

const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutes

/**
 * ActivityTracker Component
 * Manages user online/offline status by sending periodic heartbeats
 * Should be mounted at the app root level when user is authenticated
 */
const ActivityTracker = () => {
  const dispatch = useDispatch();
  const db = useAsyncSQLiteContext();
  const { user } = useSelector((state) => state.auth);
  const heartbeatInterval = useRef(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    console.log('[ActivityTracker] Checking conditions - user:', !!user, 'db:', !!db);
    
    if (!user || !db) {
      // Clear interval and reset activity when logged out or db not ready
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      dispatch(resetActivity());
      return;
    }

    console.log('[ActivityTracker] User authenticated, sending initial heartbeat');
    // Send initial heartbeat when user logs in
    dispatch(sendHeartbeat(db));

    // Set up periodic heartbeat
    heartbeatInterval.current = setInterval(() => {
      if (appState.current === 'active') {
        dispatch(sendHeartbeat(db));
      }
    }, HEARTBEAT_INTERVAL);

    // Handle app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - send heartbeat immediately
        dispatch(sendHeartbeat(db));
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App going to background - mark offline after a delay
        // We don't immediately mark offline to handle quick switches
        setTimeout(() => {
          if (AppState.currentState !== 'active') {
            dispatch(markUserOffline(db));
          }
        }, 30000); // 30 seconds delay before marking offline
      }
      appState.current = nextAppState;
    });

    return () => {
      // Cleanup on unmount
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      subscription.remove();
      // Mark offline when component unmounts (logout)
      if (db) {
        dispatch(markUserOffline(db));
      }
    };
  }, [user, db, dispatch]);

  // This component doesn't render anything
  return null;
};

export default ActivityTracker;

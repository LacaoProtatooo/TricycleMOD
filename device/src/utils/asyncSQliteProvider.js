// AsyncSQLiteProvider.js
import React, { useState, useEffect, createContext, useContext } from 'react';
import * as SQLite from 'expo-sqlite';

const AsyncSQLiteContext = createContext(null);

export const AsyncSQLiteProvider = ({ children, databaseName, onInit }) => {
  const [db, setDb] = useState(null);

  useEffect(() => {
    SQLite.openDatabaseAsync(databaseName)
      .then(async (dbInstance) => {
        if (onInit) {
          await onInit(dbInstance);
        }
        setDb(dbInstance);
      })
      .catch((error) => {
        console.error("Error opening database:", error);
      });
  }, [databaseName, onInit]);

  return (
    <AsyncSQLiteContext.Provider value={db}>
      {children}
    </AsyncSQLiteContext.Provider>
  );
};

export const useAsyncSQLiteContext = () => {
  const context = useContext(AsyncSQLiteContext);
  return context;
};

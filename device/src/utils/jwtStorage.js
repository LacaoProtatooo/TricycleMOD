// jwtStorage.js
// JWT Tokens are stored in SQlite

import * as SQLite from 'expo-sqlite';

export async function migrateDbIfNeeded(dbInstance) {
  try {
    // Create the users table with token
    await dbInstance.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        token TEXT
      );
    `);

    console.log("Database migrated or initialized successfully");
  } catch (error) {
    console.error("Error initializing database", error);
  }
}

export const storeToken = async (dbInstance, token) => {
  if (!dbInstance) {
    console.error("No dbInstance provided to users");
    return;
  }
  try {
    // Clear existing tokens first, then insert new one
    // Use execAsync directly to avoid transaction locking issues
    await dbInstance.execAsync("DELETE FROM users;");
    await dbInstance.runAsync("INSERT INTO users (token) VALUES (?);", [token]);
    console.log("Token stored successfully");
    console.log("Stored token:", token);
  } catch (error) {
    console.error("Error storing token", error);
    throw error;
  }
};

export const getToken = async (dbInstance) => {
  if (!dbInstance) {
    console.error("No dbInstance provided to getToken");
    return null;
  }
  try {
    const result = await dbInstance.getFirstAsync("SELECT token FROM users LIMIT 1;");
    return result?.token || null;
  } catch (error) {
    console.error("Error retrieving token", error);
    return null;
  }
};

export const removeToken = async (dbInstance) => {
  if (!dbInstance) {
    console.error("No dbInstance provided to removeToken");
    return;
  }
  try {
    // Use execAsync directly without transaction to avoid database locking
    await dbInstance.execAsync("DELETE FROM users;");
    console.log("Token removed successfully");
  } catch (error) {
    console.error("Error removing token", error);
    // Don't throw - allow logout to continue even if token removal fails
  }
};

export const logTableContents = async (dbInstance, tableName) => {
  if (!dbInstance) {
    console.error("No dbInstance provided to logTableContents");
    return;
  }
  try {
    const rows = await dbInstance.getAllAsync(`SELECT * FROM ${tableName};`);
    console.log(`Contents of ${tableName}:`, rows);
  } catch (error) {
    console.error(`Error querying ${tableName}:`, error);
  }
};






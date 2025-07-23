// src/services/userService.js

import { 
  generateIdentity, 
  generatePreKeys, 
  exportBundle 
} from '../crypto/cryptoUtils';
import { createSignalProtocolStore } from '../crypto/sessionUtils';

// In-memory storage for this demo
const registeredUsers = new Map();
const userStores = new Map();

export async function registerUserWithPhone(phoneNumber, name) {
  // Check if already registered
  if (registeredUsers.has(phoneNumber)) {
    throw new Error('Phone number already registered');
  }

  try {
    // Create signal store and generate crypto materials
    const store = createSignalProtocolStore();
    await generateIdentity(store);
    await generatePreKeys(store);
    const bundle = await exportBundle(store);

    // Create user object
    const user = {
      phoneNumber,
      name,
      bundle,
      registeredAt: new Date().toISOString(),
    };

    // Store user data
    registeredUsers.set(phoneNumber, user);
    userStores.set(phoneNumber, store);

    // Register with mock server
    const { registerUser } = await import('../mock/mockServer');
    registerUser(phoneNumber, bundle, store);

    // Save to localStorage for persistence across sessions
    localStorage.setItem('currentUser', JSON.stringify({
      phoneNumber,
      name,
      registeredAt: user.registeredAt,
    }));

    return { phoneNumber, name, registeredAt: user.registeredAt };
  } catch (error) {
    console.error('Registration failed:', error);
    throw new Error('Registration failed. Please try again.');
  }
}

export function getCurrentUser() {
  try {
    const userData = localStorage.getItem('currentUser');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export function isUserRegistered(phoneNumber) {
  return registeredUsers.has(phoneNumber);
}

export function getUserStore(phoneNumber) {
  const store = userStores.get(phoneNumber);
  if (!store) {
    throw new Error(`No store found for user ${phoneNumber}`);
  }
  return store;
}

export function getUserBundle(phoneNumber) {
  const user = registeredUsers.get(phoneNumber);
  if (!user) {
    throw new Error(`User ${phoneNumber} not found`);
  }
  return user.bundle;
}

export function getAllRegisteredUsers() {
  return Array.from(registeredUsers.values()).map(user => ({
    phoneNumber: user.phoneNumber,
    name: user.name,
    registeredAt: user.registeredAt,
  }));
}

// For cross-tab communication
window.addEventListener('storage', (e) => {
  if (e.key === 'newUserRegistered') {
    const userData = JSON.parse(e.newValue);
    // Re-initialize the newly registered user in this tab
    initializeExistingUser(userData);
  }
});

async function initializeExistingUser(userData) {
  try {
    if (!registeredUsers.has(userData.phoneNumber)) {
      // This is a user registered in another tab
      const store = createSignalProtocolStore();
      await generateIdentity(store);
      await generatePreKeys(store);
      const bundle = await exportBundle(store);

      const user = {
        phoneNumber: userData.phoneNumber,
        name: userData.name,
        bundle,
        registeredAt: userData.registeredAt,
      };

      registeredUsers.set(userData.phoneNumber, user);
      userStores.set(userData.phoneNumber, store);

      // Register with mock server
      const { registerUser } = await import('../mock/mockServer');
      registerUser(userData.phoneNumber, bundle, store);
    }
  } catch (error) {
    console.error('Failed to initialize existing user:', error);
  }
}

// Initialize any existing users on app load
export async function initializeStoredUsers() {
  const storedUsers = localStorage.getItem('allRegisteredUsers');
  if (storedUsers) {
    const users = JSON.parse(storedUsers);
    for (const userData of users) {
      await initializeExistingUser(userData);
    }
  }
}
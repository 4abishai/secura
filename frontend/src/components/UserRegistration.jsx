// src/components/UserRegistration.jsx
import { useState } from 'react';
import { generateIdentity, generatePreKeys, exportBundle } from '../crypto/cryptoUtils';
import { createSignalProtocolStore } from '../crypto/sessionUtils';
import { mockServer } from '../mock/mockServer';

const UserRegistration = ({ onUserRegistered }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    setIsRegistering(true);
    setError('');

    try {
      // Create Signal protocol store for this user
      const store = createSignalProtocolStore();
      
      // Generate cryptographic identity
      await generateIdentity(store);
      await generatePreKeys(store);
      const bundle = await exportBundle(store);

      // Register user with mock server
      const normalizedPhone = phoneNumber.replace(/\s/g, '');
      const user = {
        id: normalizedPhone,
        phoneNumber: normalizedPhone,
        registeredAt: new Date().toISOString()
      };

      mockServer.registerUser(normalizedPhone, bundle, store);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      onUserRegistered(user);
    } catch (err) {
      setError('Registration failed. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Signal Messenger
      </h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Register with Phone Number</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isRegistering}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            onClick={handleRegister}
            disabled={isRegistering}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegistering ? 'Registering...' : 'Register'}
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
        <h3 className="font-semibold mb-2">Demo Instructions:</h3>
        <ul className="space-y-1">
          <li>• Enter any valid phone number format</li>
          <li>• After registration, you can add contacts</li>
          <li>• Messages are encrypted with Signal protocol</li>
          <li>• Use different phone numbers to simulate multiple users</li>
        </ul>
      </div>
    </div>
  );
};

export default UserRegistration;
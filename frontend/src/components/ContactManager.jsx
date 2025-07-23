// src/components/ContactManager.jsx
import React, { useState, useEffect } from 'react';
import { generateIdentity, generatePreKeys, exportBundle } from '../crypto/cryptoUtils';
import { createSignalProtocolStore } from '../crypto/sessionUtils';
import { mockServer } from '../mock/mockServer';

const ContactManager = ({ currentUser, onContactSelected, onLogout }) => {
  const [contacts, setContacts] = useState([]);
  const [newContactPhone, setNewContactPhone] = useState('');
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load existing contacts from localStorage
    const savedContacts = localStorage.getItem(`contacts_${currentUser.id}`);
    if (savedContacts) {
      setContacts(JSON.parse(savedContacts));
    }
  }, [currentUser.id]);

  const saveContacts = (updatedContacts) => {
    setContacts(updatedContacts);
    localStorage.setItem(`contacts_${currentUser.id}`, JSON.stringify(updatedContacts));
  };

  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const handleAddContact = async () => {
    if (!newContactPhone.trim()) {
      setError('Please enter a phone number');
      return;
    }

    if (!validatePhoneNumber(newContactPhone)) {
      setError('Please enter a valid phone number');
      return;
    }

    const normalizedPhone = newContactPhone.replace(/\s/g, '');

    if (normalizedPhone === currentUser.id) {
      setError('Cannot add yourself as a contact');
      return;
    }

    if (contacts.some(contact => contact.id === normalizedPhone)) {
      setError('Contact already exists');
      return;
    }

    setIsAddingContact(true);
    setError('');

    try {
      // Check if this phone number exists in our mock server
      // If not, register it automatically (simulate the user being registered)
      let contactExists = false;
      try {
        mockServer.getUserBundle(normalizedPhone);
        contactExists = true;
      } catch (e) {
        // Contact doesn't exist, register them automatically
        const contactStore = createSignalProtocolStore();
        await generateIdentity(contactStore);
        await generatePreKeys(contactStore);
        const contactBundle = await exportBundle(contactStore);
        mockServer.registerUser(normalizedPhone, contactBundle, contactStore);
      }

      const newContact = {
        id: normalizedPhone,
        phoneNumber: normalizedPhone,
        name: normalizedPhone, // In a real app, you might want to ask for a name
        addedAt: new Date().toISOString()
      };

      const updatedContacts = [...contacts, newContact];
      saveContacts(updatedContacts);
      setNewContactPhone('');

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      setError('Failed to add contact. Please try again.');
      console.error('Add contact error:', err);
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleDeleteContact = (contactId) => {
    const updatedContacts = contacts.filter(contact => contact.id !== contactId);
    saveContacts(updatedContacts);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Contacts</h1>
        <button
          onClick={onLogout}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Logout
        </button>
      </div>

      <div className="mb-6 p-3 bg-blue-50 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Your Phone:</strong> {currentUser.phoneNumber}
        </p>
      </div>

      {/* Add Contact Form */}
      <div className="mb-6 p-4 border border-gray-200 rounded-md">
        <h2 className="text-lg font-semibold mb-3">Add New Contact</h2>
        
        <div className="space-y-3">
          <input
            type="tel"
            value={newContactPhone}
            onChange={(e) => setNewContactPhone(e.target.value)}
            placeholder="Enter phone number (e.g., +1234567891)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isAddingContact}
          />

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            onClick={handleAddContact}
            disabled={isAddingContact}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAddingContact ? 'Adding...' : 'Add Contact'}
          </button>
        </div>
      </div>

      {/* Contacts List */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Your Contacts</h2>
        
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No contacts yet.</p>
            <p className="text-sm">Add a contact to start messaging!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map(contact => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <div className="flex-1">
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-gray-600">{contact.phoneNumber}</p>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => onContactSelected(contact)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => handleDeleteContact(contact.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
        <h3 className="font-semibold mb-2">Demo Notes:</h3>
        <ul className="space-y-1">
          <li>• Contacts are auto-registered when added</li>
          <li>• All messages use Signal protocol encryption</li>
          <li>• Try adding +1234567891, +1234567892, etc.</li>
        </ul>
      </div>
    </div>
  );
};

export default ContactManager;
// src/App.jsx
import { useState, useEffect } from 'react';
import UserRegistration from './components/UserRegistration';
import ContactManager from './components/ContactManager';
import SecureMessenger from './components/SecureMessenger';
import './mock/mockFetchInterceptor';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [view, setView] = useState('registration'); // registration, contacts, chat

  useEffect(() => {
    // Check if user is already registered (simulate persistence)
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setView('contacts');
    }
  }, []);

  const handleUserRegistered = (user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    setView('contacts');
  };

  const handleContactSelected = (contact) => {
    setSelectedContact(contact);
    setView('chat');
  };

  const handleBackToContacts = () => {
    setSelectedContact(null);
    setView('contacts');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedContact(null);
    localStorage.removeItem('currentUser');
    setView('registration');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg">
        {view === 'registration' && (
          <UserRegistration onUserRegistered={handleUserRegistered} />
        )}
        
        {view === 'contacts' && currentUser && (
          <ContactManager 
            currentUser={currentUser}
            onContactSelected={handleContactSelected}
            onLogout={handleLogout}
          />
        )}
        
        {view === 'chat' && currentUser && selectedContact && (
          <SecureMessenger 
            currentUser={currentUser}
            contact={selectedContact}
            onBack={handleBackToContacts}
          />
        )}
      </div>
    </div>
  );
}

export default App;
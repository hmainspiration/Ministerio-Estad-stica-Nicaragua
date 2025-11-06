import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import Spinner from './components/Spinner';
import ProfileSetupModal from './components/ProfileSetupModal';
import { authService } from './services/supabaseService';
import type { User } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => console.log('ServiceWorker registration successful with scope: ', registration.scope))
          .catch(err => console.log('ServiceWorker registration failed: ', err));
      });
    }

    const checkSession = async () => {
      const currentUser = await authService.getUser();
      setUser(currentUser);
      setLoading(false);
    };
    
    checkSession();

    const { unsubscribe } = authService.onAuthStateChange((_event, sessionUser) => {
      setUser(sessionUser);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // If user is logged in but has the default or no church name, prompt for setup.
    if (user && (user.church_name === 'Mi Iglesia' || !user.church_name)) {
      setNeedsProfileSetup(true);
    } else {
      setNeedsProfileSetup(false);
    }
  }, [user]);

  const handleProfileCreated = (updatedUser: User) => {
    setUser(updatedUser);
    setNeedsProfileSetup(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <Spinner size="h-16 w-16" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {user ? (
        <>
          <Dashboard user={user} />
          {needsProfileSetup && <ProfileSetupModal user={user} onProfileCreated={handleProfileCreated} />}
        </>
      ) : <LoginPage />}
    </div>
  );
};

export default App;

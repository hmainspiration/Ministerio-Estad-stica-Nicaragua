import React, { useState } from 'react';
// Fix: The 'Profile' type does not exist; using the 'User' type instead,
// as it contains all the necessary user information including 'church_name'.
import type { User } from '../types';
import { authService } from '../services/supabaseService';
import Spinner from './Spinner';

interface ProfileSetupModalProps {
  user: User;
  onProfileCreated: (profile: User) => void;
}

const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({ user, onProfileCreated }) => {
  const [churchName, setChurchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!churchName.trim()) {
      setError('Por favor, ingresa el nombre de la iglesia.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Fix: 'createProfile' did not exist on 'authService'. It has been added to update
      // the user's metadata with the provided church name.
      const newProfile = await authService.createProfile(user, churchName.trim());
      onProfileCreated(newProfile);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el perfil. Inténtalo de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-80">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 m-4 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Completar Perfil</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Parece que es tu primera vez aquí. Por favor, ingresa el nombre de tu iglesia para continuar.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="church-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nombre de la Iglesia
            </label>
            <input
              id="church-name"
              type="text"
              value={churchName}
              onChange={(e) => setChurchName(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: Iglesia Central"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
            >
              {loading ? <Spinner size="h-5 w-5" /> : 'Guardar y Continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetupModal;
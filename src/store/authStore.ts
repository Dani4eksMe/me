import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface AuthState {
  user: Profile | null;
  setUser: (user: Profile | null) => void;
  signUp: (username: string, password: string) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  
  signUp: async (username: string, password: string) => {
    try {
      // First check if username exists
      const { data: existingUsers, error: lookupError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username);

      if (lookupError) throw lookupError;
      if (existingUsers && existingUsers.length > 0) {
        throw new Error('Username already taken');
      }

      // Generate a unique email using username and a random string
      const uniqueId = Math.random().toString(36).substring(2);
      const email = `${username.toLowerCase()}_${uniqueId}@messenger.app`;

      // Create auth user
      const { data: { user }, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      if (!user) throw new Error('Signup failed');

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username,
          avatar_url: null,
        });

      if (profileError) {
        // If profile creation fails, clean up the auth user
        await supabase.auth.signOut();
        throw profileError;
      }

      set({ user: { id: user.id, username, avatar_url: null } });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('An error occurred during signup');
    }
  },

  signIn: async (username: string, password: string) => {
    try {
      // First get the user's email from their profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (profileError) {
        throw new Error('Username not found');
      }

      // Get the user's auth details
      const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUserById(profile.id);
      
      if (authError || !authUser) {
        throw new Error('User not found');
      }

      // Sign in with the email
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email: authUser.email!,
        password,
      });

      if (error) throw error;
      if (!user) throw new Error('Login failed');

      // Get full profile data
      const { data: fullProfile, error: fullProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fullProfileError) {
        await supabase.auth.signOut();
        throw new Error('Profile not found');
      }

      set({ user: fullProfile });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('An error occurred during sign in');
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },

  updateProfile: async (updates) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('No user logged in');

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;

    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    }));
  },
}));
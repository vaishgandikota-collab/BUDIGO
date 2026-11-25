import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { getSupabase } from '../config/supabase';
import { UserProfile } from '../types';

// In-memory profiles when running in test/local development mode
const inMemoryProfiles = new Map<string, UserProfile>();

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { fullName, email, password } = req.body;
      if (!email || !fullName) {
        return res.status(400).json({ success: false, error: 'Full name and email are required.' });
      }

      const supabase = getSupabase();
      if (supabase && password) {
        let user: any = null;
        try {
          const { data: adminData, error: adminErr } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          });

          if (adminErr) {
            if (adminErr.message.toLowerCase().includes('already') || adminErr.status === 422) {
              return res.status(409).json({ success: false, error: 'Email already registered' });
            }
            throw adminErr;
          }
          user = adminData.user;
        } catch (e: any) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
          });

          if (error) {
            if (error.message.toLowerCase().includes('already') || error.status === 422) {
              return res.status(409).json({ success: false, error: 'Email already registered' });
            }
            return res.status(400).json({ success: false, error: error.message });
          }
          user = data.user;
        }

        if (user) {
          await supabase.from('profiles').upsert({
            id: user.id,
            full_name: fullName,
            email,
          });

          const token = jwt.sign(
            { id: user.id, email, displayName: fullName },
            ENV.JWT_SECRET,
            { expiresIn: '7d' }
          );

          return res.status(201).json({
            success: true,
            token,
            user: { id: user.id, full_name: fullName, email },
          });
        }
      }

      if (ENV.NODE_ENV === 'production') {
        return res.status(503).json({ success: false, error: 'Database service unavailable in production' });
      }

      // Local / Dev mode
      const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const profile: UserProfile = {
        id,
        full_name: fullName,
        email,
        avatar_url: `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(fullName)}`,
        created_at: new Date().toISOString(),
      };
      inMemoryProfiles.set(id, profile);

      const token = jwt.sign(
        { id, email, displayName: fullName },
        ENV.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        success: true,
        token,
        user: profile,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required.' });
      }

      const supabase = getSupabase();
      if (supabase && password) {
        let { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        // If demo user or dev account doesn't exist yet, auto-provision it with confirmed email
        if (error && (email.includes('@budigo.app') || ENV.NODE_ENV !== 'production')) {
          const { data: newUserData, error: createErr } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: email.split('@')[0] },
          });

          if (!createErr && newUserData?.user) {
            await supabase.from('profiles').upsert({
              id: newUserData.user.id,
              full_name: email.split('@')[0],
              email,
            });
            const loginRes = await supabase.auth.signInWithPassword({ email, password });
            data = loginRes.data;
            error = loginRes.error;
          }
        }

        if (error || !data?.user) {
          return res.status(401).json({ success: false, error: error?.message || 'Invalid email or password.' });
        }

        const user = data.user;
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name || email.split('@')[0],
          email: user.email!,
        });

        const token = jwt.sign(
          { id: user.id, email: user.email, displayName: user.user_metadata?.full_name || email.split('@')[0] },
          ENV.JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.json({
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || email.split('@')[0],
          },
        });
      }

      if (ENV.NODE_ENV === 'production') {
        return res.status(503).json({ success: false, error: 'Database service unavailable in production' });
      }

      // Find or create profile in memory
      let profile: UserProfile | undefined;
      for (const p of inMemoryProfiles.values()) {
        if (p.email.toLowerCase() === email.toLowerCase()) {
          profile = p;
          break;
        }
      }

      if (!profile) {
        const id = `user_${Date.now()}`;
        profile = {
          id,
          full_name: email.split('@')[0],
          email,
          avatar_url: `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(email)}`,
          created_at: new Date().toISOString(),
        };
        inMemoryProfiles.set(id, profile);
      }

      const token = jwt.sign(
        { id: profile.id, email: profile.email, displayName: profile.full_name },
        ENV.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        token,
        user: profile,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getProfile(req: any, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) return res.json({ success: true, user: data });
    }

    const local = inMemoryProfiles.get(userId);
    if (local) return res.json({ success: true, user: local });

    return res.json({
      success: true,
      user: {
        id: userId,
        full_name: req.user.displayName || 'Budigo Traveler',
        email: req.user.email || `${userId}@budigo.app`,
      },
    });
  }

  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ success: false, error: 'A valid email address is required.' });
      }

      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) {
          return res.status(400).json({ success: false, error: error.message });
        }
      }

      return res.json({
        success: true,
        message: `Password reset instructions have been dispatched to ${email.trim()}.`,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { newPassword, token } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
      }

      const supabase = getSupabase();
      if (supabase && token) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
          return res.status(400).json({ success: false, error: error.message });
        }
      }

      return res.json({
        success: true,
        message: 'Password updated successfully. You can now log in with your new password.',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

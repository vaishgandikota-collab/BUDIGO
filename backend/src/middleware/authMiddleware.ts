import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ENV } from '../config/env';
import { getSupabase } from '../config/supabase';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    displayName?: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Missing Bearer token.',
      });
    }

    const token = authHeader.split(' ')[1];

    // 1. First check Supabase Auth if configured
    const supabase = getSupabase();
    if (supabase) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user && !error) {
        req.user = {
          id: user.id,
          email: user.email,
          displayName: user.user_metadata?.full_name || user.email?.split('@')[0],
        };
        return next();
      }
    }

    // 2. Verify JWT directly (for custom / mobile JWT)
    try {
      const decoded: any = jwt.verify(token, ENV.JWT_SECRET);
      req.user = {
        id: decoded.id || decoded.sub,
        email: decoded.email,
        displayName: decoded.displayName || decoded.full_name,
      };

      // If Supabase is active, ensure req.user.id is always a valid UUID in the profiles table
      if (supabase && req.user) {
        if (!UUID_REGEX.test(req.user.id)) {
          const userEmail = req.user.email || `${req.user.id}@budigo.app`;
          const displayName = req.user.displayName || 'Budigo Traveler';

          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', userEmail)
            .single();

          if (existingProfile && UUID_REGEX.test(existingProfile.id)) {
            req.user.id = existingProfile.id;
          } else {
            const newUuid = crypto.randomUUID();
            await supabase.from('profiles').upsert({
              id: newUuid,
              full_name: displayName,
              email: userEmail,
            });
            req.user.id = newUuid;
          }
        } else {
          await supabase.from('profiles').upsert(
            {
              id: req.user.id,
              full_name: req.user.displayName || 'Budigo Traveler',
              email: req.user.email || `${req.user.id}@budigo.app`,
            },
            { onConflict: 'id' }
          );
        }
      }

      return next();
    } catch (jwtErr) {
      // In local dev/testing if dummy token passed with user id
      if (ENV.NODE_ENV !== 'production' && token.startsWith('test_user_')) {
        req.user = {
          id: token,
          email: `${token}@budigo.app`,
          displayName: `User ${token.replace('test_user_', '')}`,
        };
        return next();
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired authentication token.',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Authentication failed.',
    });
  }
}

export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return authMiddleware(req, res, next);
}



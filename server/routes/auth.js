const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, getSupabaseAdmin } = require('../config/supabase');
const { auth } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    const authClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const adminClient = getSupabaseAdmin();
    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({
        success: false,
        message: 'User profile not found'
      });
    }

    if (!profile.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive. Please contact an administrator.'
      });
    }

    res.cookie('token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        school: profile.school,
        position: profile.position
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

router.post('/logout', auth, async (req, res) => {
  try {
    if (req.token) {
      await supabase.auth.signOut(req.token);
    }

    res.clearCookie('token');

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.clearCookie('token');
    res.json({
      success: true,
      message: 'Logout successful'
    });
  }
});

router.get('/me', auth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      school: req.user.school,
      position: req.user.position,
      lastLogin: req.user.lastLogin
    }
  });
});

router.put('/change-password', [
  auth,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  body('confirmPassword').notEmpty().withMessage('Password confirmation is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    const passwordRegex = {
      minLength: newPassword.length >= 8,
      hasLowercase: /[a-z]/.test(newPassword),
      hasUppercase: /[A-Z]/.test(newPassword),
      hasNumber: /\d/.test(newPassword),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
    };

    const strengthScore = Object.values(passwordRegex).filter(Boolean).length;
    if (strengthScore < 3) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least 3 of: lowercase, uppercase, number, special character'
      });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword
    });

    if (signInError) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update password'
      });
    }

    console.log(`Password changed successfully for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing password'
    });
  }
});

router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/html/reset-password.html`
    });

    if (error) {
      console.error('Password reset error:', error);
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });
  }
});

router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('confirmPassword').notEmpty().withMessage('Password confirmation is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    const passwordRegex = {
      minLength: newPassword.length >= 8,
      hasLowercase: /[a-z]/.test(newPassword),
      hasUppercase: /[A-Z]/.test(newPassword),
      hasNumber: /\d/.test(newPassword),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
    };

    const strengthScore = Object.values(passwordRegex).filter(Boolean).length;
    if (strengthScore < 3) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least 3 of: lowercase, uppercase, number, special character'
      });
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('Reset password error:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resetting password'
    });
  }
});

module.exports = router;

const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, getSupabaseAdmin } = require('../config/supabase');
const { auth, adminAuth, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: users, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, name, role, school, position, is_active, last_login, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch users error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch users'
      });
    }

    res.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        school: user.school,
        position: user.position,
        isActive: user.is_active,
        lastLogin: user.last_login,
        createdAt: user.created_at
      }))
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

router.post('/', [
  auth,
  adminOnly,
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('confirmPassword').notEmpty().withMessage('Password confirmation is required'),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('school').trim().isLength({ min: 2 }).withMessage('School must be at least 2 characters'),
  body('role').isIn(['member', 'executive', 'admin']).withMessage('Invalid role selected')
], async (req, res) => {
  try {
    console.log(`User creation request from admin: ${req.user.email}`);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, confirmPassword, name, role, school, position } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    const passwordRequirements = {
      minLength: password.length >= 8,
      hasLowercase: /[a-z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /\d/.test(password)
    };

    const strengthScore = Object.values(passwordRequirements).filter(Boolean).length;
    const unmetRequirements = [];

    if (!passwordRequirements.minLength) unmetRequirements.push('at least 8 characters');
    if (!passwordRequirements.hasLowercase) unmetRequirements.push('at least one lowercase letter');
    if (!passwordRequirements.hasUppercase) unmetRequirements.push('at least one uppercase letter');
    if (!passwordRequirements.hasNumber) unmetRequirements.push('at least one number');

    if (strengthScore < 3) {
      return res.status(400).json({
        success: false,
        message: `Password does not meet minimum requirements. Missing: ${unmetRequirements.join(', ')}`
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: existingUser } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // Role validation - only admins can create other admins
    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create admin accounts'
      });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for admin-created users
      user_metadata: {
        name,
        role,
        school,
        position: position || 'Parent Representative'
      }
    });

    if (authError) {
      console.error('Create user auth error:', authError);
      let errorMessage = 'Failed to create user';

      if (authError.message && authError.message.includes('already registered')) {
        errorMessage = 'This email address is already registered';
      } else if (authError.message && authError.message.includes('duplicate')) {
        errorMessage = 'A user with this email already exists';
      } else if (authError.message) {
        errorMessage = authError.message;
      }

      return res.status(400).json({
        success: false,
        message: errorMessage
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile creation verification failed:', profileError);
      const { error: manualProfileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email,
          name,
          role: role || 'member',
          school,
          position: position || 'Parent Representative'
        });

      if (manualProfileError) {
        console.error('Manual profile creation failed:', manualProfileError);
        return res.status(500).json({
          success: false,
          message: 'User created but profile setup failed'
        });
      }
    }

    console.log(`User created successfully: ${email} (${role}) by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: `User created successfully with ${strengthScore >= 4 ? 'strong' : strengthScore === 3 ? 'good' : 'acceptable'} password security`,
      user: {
        id: authData.user.id,
        name,
        email,
        role: role || 'member',
        school,
        position: position || 'Parent Representative',
        createdAt: authData.user.created_at
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating user'
    });
  }
});

router.put('/:id', [
  auth,
  adminOnly,
  body('name').optional().trim().isLength({ min: 2 }),
  body('school').optional().trim().isLength({ min: 2 }),
  body('role').optional().isIn(['member', 'executive', 'admin']),
  body('position').optional().trim()
], async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, school, role, position, is_active } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (userId === req.user.id && role && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own admin role'
      });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (school !== undefined) updates.school = school;
    if (role !== undefined) updates.role = role;
    if (position !== undefined) updates.position = position;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Update user error:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to update user'
      });
    }

    console.log(`User updated successfully: ${updatedUser.email} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        school: updatedUser.school,
        position: updatedUser.position,
        isActive: updatedUser.is_active
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user'
    });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const userId = req.params.id;

    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Delete user error:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete user'
      });
    }

    console.log(`User deleted successfully: ${user.email} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user'
    });
  }
});

module.exports = router;


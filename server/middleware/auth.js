const { supabase, getSupabaseAdmin } = require('../config/supabase');

/**
 * REQUIRED Authentication Middleware
 * Verifies JWT token and attaches user data to request
 */
const auth = async (req, res, next) => {
  try {
    const token = req.cookies.token ||
                  req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }

    const adminClient = getSupabaseAdmin();
    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User profile not found or inactive.'
      });
    }

    supabase
      .from('user_profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id)
      .then()
      .catch(console.error);

    req.user = {
      id: user.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      school: profile.school,
      position: profile.position,
      isActive: profile.is_active,
      lastLogin: profile.last_login
    };

    req.token = token;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

/**
 * OPTIONAL Authentication Middleware
 * Attaches user data if token is valid, otherwise sets req.user = null
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token ||
                  req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      req.user = null;
      return next();
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      req.user = null;
      return next();
    }

    const adminClient = getSupabaseAdmin();
    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.is_active) {
      req.user = null;
      return next();
    }

    req.user = {
      id: user.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      school: profile.school,
      position: profile.position,
      isActive: profile.is_active,
      lastLogin: profile.last_login
    };

    req.token = token;

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
};

/**
 * Admin/Executive Authorization Middleware
 * Must be chained after auth middleware
 */
const adminAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'executive') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Executive privileges required.'
    });
  }

  next();
};

/**
 * Admin-only Authorization Middleware
 * Must be chained after auth middleware
 */
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  next();
};

module.exports = {
  auth,
  optionalAuth,
  adminAuth,
  adminOnly
};

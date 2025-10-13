const SupabaseAuth = (function() {
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://interparents.eu';

  async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include'
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...defaultOptions,
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  }

  async function login(email, password) {
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (data.success) {
        sessionStorage.setItem('user', JSON.stringify(data.user));
        return { success: true, user: data.user };
      }

      return { success: false, message: data.message };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: error.message };
    }
  }

  async function logout() {
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST'
      });

      sessionStorage.removeItem('user');
      window.location.href = '/html/login.html';
    } catch (error) {
      console.error('Logout error:', error);
      sessionStorage.removeItem('user');
      window.location.href = '/html/login.html';
    }
  }

  async function getCurrentUser() {
    const cachedUser = sessionStorage.getItem('user');
    if (cachedUser) {
      return JSON.parse(cachedUser);
    }

    try {
      const data = await apiRequest('/api/auth/me');
      if (data.success && data.user) {
        sessionStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
      }
      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  async function isAuthenticated() {
    const user = await getCurrentUser();
    return user !== null;
  }

  async function hasRole(role) {
    const user = await getCurrentUser();
    if (!user) return false;

    if (Array.isArray(role)) {
      return role.includes(user.role);
    }

    return user.role === role;
  }

  async function requireAuth(allowedRoles = null) {
    const user = await getCurrentUser();

    if (!user) {
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      window.location.href = '/html/login.html';
      return false;
    }

    if (allowedRoles) {
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      if (!roles.includes(user.role)) {
        alert('Access denied. You do not have permission to view this page.');
        window.location.href = '/html/dashboard.html';
        return false;
      }
    }

    return true;
  }

  async function changePassword(currentPassword, newPassword, confirmPassword) {
    try {
      const data = await apiRequest('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });

      return data;
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, message: error.message };
    }
  }

  async function forgotPassword(email) {
    try {
      const data = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      return data;
    } catch (error) {
      console.error('Forgot password error:', error);
      return { success: false, message: error.message };
    }
  }

  async function resetPassword(token, newPassword, confirmPassword) {
    try {
      const data = await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword, confirmPassword })
      });

      return data;
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, message: error.message };
    }
  }

  async function api(endpoint, options = {}) {
    try {
      return await apiRequest(endpoint, options);
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('token')) {
        sessionStorage.removeItem('user');
        window.location.href = '/html/login.html';
      }
      throw error;
    }
  }

  return {
    login,
    logout,
    getCurrentUser,
    isAuthenticated,
    hasRole,
    requireAuth,
    changePassword,
    forgotPassword,
    resetPassword,
    api,
    API_BASE_URL
  };
})();

window.SupabaseAuth = SupabaseAuth;

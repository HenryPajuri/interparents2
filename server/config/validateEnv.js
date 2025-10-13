const requiredEnvVars = {
  development: [
    'PORT',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SESSION_SECRET',
    'FRONTEND_URL'
  ],
  production: [
    'PORT',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SESSION_SECRET',
    'FRONTEND_URL'
  ]
};

const validateEnv = () => {
  const env = process.env.NODE_ENV || 'development';
  const required = requiredEnvVars[env] || requiredEnvVars.development;

  const missing = required.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    console.error('   See .env.example for reference.\n');
    process.exit(1);
  }

  if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith('https://')) {
    console.error('SUPABASE_URL must start with https://');
    process.exit(1);
  }

  if (env === 'production') {
    const weakSecrets = [
      'your-project.supabase.co',
      'your-anon-key-here',
      'your-service-role-key-here',
      'generate-a-secure-random-string',
      'change-this',
      'secret',
      '123456'
    ];

    const hasWeakSecret = weakSecrets.some(weak =>
      process.env.SESSION_SECRET?.includes(weak) ||
      process.env.SUPABASE_URL?.includes(weak) ||
      process.env.SUPABASE_ANON_KEY?.includes(weak) ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.includes(weak)
    );

    if (hasWeakSecret) {
      console.error('Production environment detected with default/weak secrets!');
      console.error('   Please generate secure random strings for all secrets.\n');
      process.exit(1);
    }

    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
      console.error('SESSION_SECRET must be at least 32 characters in production');
      process.exit(1);
    }
  }

  console.log('Environment variables validated successfully');
};

module.exports = validateEnv;

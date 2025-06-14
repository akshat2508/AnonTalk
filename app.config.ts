import 'dotenv/config';

export default {
  expo: {
    name: 'AnonTalk',
    slug: 'anontalk',
    version: '1.0.0',
    orientation: 'portrait',
    sdkVersion: '50.0.0',
    extra: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    }
  }
};

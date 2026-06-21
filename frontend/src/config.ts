export const API_BASE_URL = import.meta.env.DEV 
  ? 'http://localhost:8000' 
  : 'https://astram-oruw.onrender.com';

export const WS_BASE_URL = import.meta.env.DEV 
  ? 'ws://localhost:8000' 
  : 'wss://astram-oruw.onrender.com';

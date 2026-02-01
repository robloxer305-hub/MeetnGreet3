import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.js';

export default function TestConnection() {
  const [status, setStatus] = useState('Testing...');
  const [result, setResult] = useState(null);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      console.log('Testing API connection...');
      const response = await api.get('/groups');
      console.log('API Response:', response.data);
      setStatus('✅ API Connected Successfully!');
      setResult(response.data);
    } catch (error) {
      console.error('API Test Failed:', error);
      setStatus('❌ API Connection Failed');
      setResult(error.message);
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h3 className="text-lg font-bold mb-2">API Connection Test</h3>
      <div className={`text-sm font-medium ${status.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
        {status}
      </div>
      {result && (
        <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      <button 
        onClick={testConnection}
        className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm"
      >
        Test Again
      </button>
    </div>
  );
}

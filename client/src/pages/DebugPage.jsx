import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.js';

export default function DebugPage() {
  const [status, setStatus] = useState('Loading...');
  const [error, setError] = useState(null);
  const [apiResponse, setApiResponse] = useState(null);

  useEffect(() => {
    testAPI();
  }, []);

  const testAPI = async () => {
    try {
      console.log('Testing API connection...');
      console.log('API URL:', import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001');
      
      const response = await api.get('/groups');
      console.log('API Response:', response.data);
      
      setStatus('API Connected Successfully!');
      setApiResponse(response.data);
    } catch (error) {
      console.error('API Test Failed:', error);
      setStatus('API Connection Failed');
      setError(error.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">API Debug Page</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
        <div className={`text-lg font-medium ${status.includes('Success') ? 'text-green-600' : 'text-red-600'}`}>
          {status}
        </div>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="text-red-800 font-medium">Error:</div>
            <div className="text-red-600">{error}</div>
          </div>
        )}
      </div>

      {apiResponse && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">API Response</h2>
          <pre className="bg-gray-100 p-4 rounded-md overflow-auto">
            {JSON.stringify(apiResponse, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Environment Info</h2>
        <div className="space-y-2">
          <div><strong>API Base URL:</strong> {import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}</div>
          <div><strong>Current URL:</strong> {window.location.href}</div>
          <div><strong>Token:</strong> {localStorage.getItem('token') ? 'Present' : 'Not found'}</div>
        </div>
      </div>
    </div>
  );
}

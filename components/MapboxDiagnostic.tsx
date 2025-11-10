"use client";

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

const MapboxDiagnostic: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState({
    tokenExists: false,
    tokenFormat: false,
    tokenLength: 0,
    networkAccess: false,
    mapboxApiAccess: false,
    loading: true
  });

  useEffect(() => {
    const runDiagnostics = async () => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      
      // Check if token exists
      const tokenExists = !!token;
      
      // Check token format (should start with 'pk.' for public tokens)
      const tokenFormat = token ? token.startsWith('pk.') : false;
      
      // Check token length (typical Mapbox tokens are around 100+ characters)
      const tokenLength = token ? token.length : 0;
      
      let networkAccess = false;
      let mapboxApiAccess = false;
      
      if (token) {
        try {
          // Test basic network access
          const networkTest = await fetch('https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=' + token);
          networkAccess = true;
          
          // Test if token has proper permissions
          if (networkTest.ok) {
            mapboxApiAccess = true;
          } else {
            console.error('Mapbox API response:', networkTest.status, networkTest.statusText);
          }
        } catch (error) {
          console.error('Network/API test failed:', error);
        }
      }
      
      setDiagnostics({
        tokenExists,
        tokenFormat,
        tokenLength,
        networkAccess,
        mapboxApiAccess,
        loading: false
      });
    };
    
    runDiagnostics();
  }, []);

  const DiagnosticItem: React.FC<{
    icon: React.ReactNode;
    title: string;
    status: 'success' | 'error' | 'warning';
    description: string;
  }> = ({ icon, title, status, description }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg border">
      <div className={`flex-shrink-0 ${
        status === 'success' ? 'text-green-500' : 
        status === 'error' ? 'text-red-500' : 'text-yellow-500'
      }`}>
        {icon}
      </div>
      <div>
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-sm text-gray-600">{description}</div>
      </div>
    </div>
  );

  if (diagnostics.loading) {
    return (
      <div className="p-6 bg-white rounded-lg border">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Running Mapbox Diagnostics...</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg border">
      <div className="flex items-center gap-2 mb-6">
        <Info className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Mapbox Configuration Diagnostics</h3>
      </div>
      
      <div className="space-y-4">
        <DiagnosticItem
          icon={<CheckCircle className="h-5 w-5" />}
          title="Token Exists"
          status={diagnostics.tokenExists ? 'success' : 'error'}
          description={
            diagnostics.tokenExists 
              ? 'Mapbox access token found in environment variables'
              : 'No Mapbox access token found. Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env file'
          }
        />
        
        {diagnostics.tokenExists && (
          <>
            <DiagnosticItem
              icon={<CheckCircle className="h-5 w-5" />}
              title="Token Format"
              status={diagnostics.tokenFormat ? 'success' : 'error'}
              description={
                diagnostics.tokenFormat 
                  ? 'Token format is correct (starts with pk.)'
                  : 'Token format is incorrect. Public tokens should start with "pk."'
              }
            />
            
            <DiagnosticItem
              icon={<Info className="h-5 w-5" />}
              title="Token Length"
              status={diagnostics.tokenLength > 50 ? 'success' : 'warning'}
              description={`Token length: ${diagnostics.tokenLength} characters ${
                diagnostics.tokenLength > 50 ? '(looks good)' : '(seems too short)'
              }`}
            />
            
            <DiagnosticItem
              icon={<CheckCircle className="h-5 w-5" />}
              title="Network Access"
              status={diagnostics.networkAccess ? 'success' : 'error'}
              description={
                diagnostics.networkAccess 
                  ? 'Successfully connected to Mapbox API'
                  : 'Failed to connect to Mapbox API. Check your internet connection'
              }
            />
            
            <DiagnosticItem
              icon={<CheckCircle className="h-5 w-5" />}
              title="API Access"
              status={diagnostics.mapboxApiAccess ? 'success' : 'error'}
              description={
                diagnostics.mapboxApiAccess 
                  ? 'Token has proper permissions for map access'
                  : 'Token authentication failed. Check if token is valid and has proper permissions'
              }
            />
          </>
        )}
      </div>
      
      {!diagnostics.tokenExists && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">How to fix:</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer" className="underline">Mapbox Account</a> and copy your access token</li>
            <li>Add it to your .env file: <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token_here</code></li>
            <li>Restart your development server</li>
          </ol>
        </div>
      )}
      
      {diagnostics.tokenExists && !diagnostics.mapboxApiAccess && (
        <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <h4 className="font-medium text-red-900 mb-2">Possible solutions:</h4>
          <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
            <li>Verify your token is correct and hasn't expired</li>
            <li>Check if your token has the required scopes (styles:read, fonts:read, etc.)</li>
            <li>Try creating a new access token from your Mapbox account</li>
            <li>Check browser console for detailed error messages</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default MapboxDiagnostic;

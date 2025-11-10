"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import dynamic from 'next/dynamic';
import Map, { Marker, Source, Layer, NavigationControl, GeolocateControl } from 'react-map-gl';
import type { MapRef, ViewState } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { EmployeeLocation, fetchEmployeeLocations, fetchLatestEmployeeLocation } from '@/lib/supabaseClient';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MapPin, Navigation, Clock } from 'lucide-react';

interface MapboxMapProps {
  employeeId: string;
  location?: { lat: number; lng: number } | string | null;
  showPath?: boolean;
  attendanceLogId?: string;
  locations?: EmployeeLocation[];
  containerType?: 'current-location' | 'movement-path';
  height?: string;
  width?: string;
}

const DEFAULT_LOCATION = { lat: 23.0225, lng: 72.5714 }; // Ahmedabad

const MapboxMap: React.FC<MapboxMapProps> = ({ 
  employeeId,
  location,
  showPath = false,
  attendanceLogId,
  locations,
  containerType = 'current-location',
  height = '400px',
  width = '100%'
}) => {
  const mapRef = useRef<MapRef>(null);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [employeeLocations, setEmployeeLocations] = useState<EmployeeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [noLocationData, setNoLocationData] = useState(false);
  const [viewState, setViewState] = useState<ViewState>({
    longitude: DEFAULT_LOCATION.lng,
    latitude: DEFAULT_LOCATION.lat,
    zoom: 12,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 }
  });

  // Get Mapbox access token
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!MAPBOX_TOKEN) {
    console.error('Mapbox access token is not configured. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env file');
  } else {
    console.log('Mapbox token found:', MAPBOX_TOKEN.substring(0, 10) + '...');
  }

  // Parse location coordinates
  const parseLocation = useCallback((loc: { lat: number; lng: number } | string | null): [number, number] | null => {
    if (!loc) return null;
    
    if (typeof loc === 'string') {
      const parts = loc.split(',');
      if (parts.length === 2) {
        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());
        if (!isNaN(lat) && !isNaN(lng)) {
          return [lat, lng];
        }
      }
    } else if (loc.lat && loc.lng) {
      return [loc.lat, loc.lng];
    }
    
    return null;
  }, []);

  // Load employee locations for path display
  const loadEmployeeLocations = useCallback(async () => {
    if (!showPath || !attendanceLogId) return;

    try {
      setLoading(true);
      const locations = await fetchEmployeeLocations(attendanceLogId, true);
      
      if (locations && locations.length > 0) {
        setEmployeeLocations(locations);
        // Center map on first location
        const firstLocation = locations[0];
        setViewState(prev => ({
          ...prev,
          longitude: firstLocation.longitude,
          latitude: firstLocation.latitude,
          zoom: 14
        }));
      } else {
        setNoLocationData(true);
      }
    } catch (err) {
      console.error('Error loading employee locations:', err);
      setError('Failed to load location data');
    } finally {
      setLoading(false);
    }
  }, [showPath, attendanceLogId]);

  // Load single location
  const loadSingleLocation = useCallback(async () => {
    try {
      setLoading(true);
      
      let locationCoords: [number, number] | null = null;

      if (location) {
        locationCoords = parseLocation(location);
      } else {
        // Fetch latest location for employee
        const latestLocation = await fetchLatestEmployeeLocation(employeeId);
        if (latestLocation) {
          locationCoords = [latestLocation.latitude, latestLocation.longitude];
        }
      }

      if (locationCoords) {
        setCoords(locationCoords);
        setViewState(prev => ({
          ...prev,
          longitude: locationCoords[1],
          latitude: locationCoords[0],
          zoom: 15
        }));
      } else {
        setNoLocationData(true);
      }
    } catch (err) {
      console.error('Error loading location:', err);
      setError('Failed to load location data');
    } finally {
      setLoading(false);
    }
  }, [location, employeeId, parseLocation]);

  // Initialize map data
  useEffect(() => {
    if (locations && locations.length > 0) {
      // Use provided locations
      setEmployeeLocations(locations);
      setLoading(false);
      
      // Center map on first location
      const firstLocation = locations[0];
      setViewState(prev => ({
        ...prev,
        longitude: firstLocation.longitude,
        latitude: firstLocation.latitude,
        zoom: 14
      }));
    } else if (showPath) {
      loadEmployeeLocations();
    } else {
      loadSingleLocation();
    }
  }, [showPath, locations, loadEmployeeLocations, loadSingleLocation]);

  // Create GeoJSON for path
  const pathGeoJSON = React.useMemo(() => {
    if (!showPath || employeeLocations.length === 0) return null;

    const coordinates = employeeLocations.map(loc => [loc.longitude, loc.latitude]);
    
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates
      }
    };
  }, [showPath, employeeLocations]);

  // Path layer style
  const pathLayerStyle = {
    id: 'path',
    type: 'line' as const,
    paint: {
      'line-color': '#006DA8',
      'line-width': 3,
      'line-opacity': 0.8
    }
  };

  // Handle map errors
  const handleMapError = useCallback((event: any) => {
    console.error('Mapbox error details:', {
      error: event.error,
      message: event.error?.message,
      status: event.error?.status
    });
    
    let errorMessage = 'Failed to load map';
    
    if (event.error?.message) {
      if (event.error.message.includes('401') || event.error.message.includes('Unauthorized')) {
        errorMessage = 'Invalid Mapbox access token. Please check your token.';
      } else if (event.error.message.includes('403') || event.error.message.includes('Forbidden')) {
        errorMessage = 'Mapbox token does not have required permissions.';
      } else if (event.error.message.includes('network') || event.error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else {
        errorMessage = `Map error: ${event.error.message}`;
      }
    }
    
    setError(errorMessage);
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <div className="text-center max-w-md mx-4">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Mapbox Token Not Configured</p>
          <p className="text-sm text-gray-500 mt-2">
            Please add your Mapbox access token to the .env file:
          </p>
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-left">
            <code className="text-xs text-gray-700">
              NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token_here
            </code>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Restart the development server after adding the token.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 rounded-lg border border-red-200">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 font-medium">Map Error</p>
          <p className="text-red-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border" style={{ height, width }}>
        <LoadingSpinner size="lg" text="Loading map..." />
      </div>
    );
  }

  if (noLocationData) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border">
        <div className="text-center">
          <Navigation className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">No Location Data</p>
          <p className="text-gray-500 text-sm mt-2">
            {showPath ? 'No movement path found for this attendance log' : 'No location data available for this employee'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border" style={{ height, width }}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onError={handleMapError}
        attributionControl={false}
      >
        {/* Navigation Controls */}
        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />

        {/* Single location marker */}
        {!showPath && coords && (
          <Marker
            longitude={coords[1]}
            latitude={coords[0]}
            anchor="bottom"
          >
            <div className="relative">
              <div className="bg-[#006DA8] text-white p-2 rounded-full shadow-lg">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-4 border-l-transparent border-r-transparent border-t-[#006DA8]"></div>
            </div>
          </Marker>
        )}

        {/* Path visualization */}
        {showPath && pathGeoJSON && (
          <Source id="path-source" type="geojson" data={pathGeoJSON}>
            <Layer {...pathLayerStyle} />
          </Source>
        )}

        {/* Path markers */}
        {showPath && employeeLocations.map((loc, index) => (
          <Marker
            key={`${loc.id}-${index}`}
            longitude={loc.longitude}
            latitude={loc.latitude}
            anchor="center"
          >
            <div className="relative group">
              <div className={`rounded-full shadow-lg ${
                loc?.is_attendance_location 
                  ? 'bg-pink-500 p-2.5' // Pink for attendance log locations
                  : index === 0 
                    ? 'bg-green-500 p-2.5' 
                    : index === employeeLocations.length - 1 
                      ? 'bg-red-500 p-2.5' 
                      : 'bg-[#006DA8] p-1.5'
              }`}>
                <div className={`bg-white rounded-full ${
                  loc?.is_attendance_location || index === 0 || index === employeeLocations.length - 1 
                    ? 'w-3 h-3' 
                    : 'w-2 h-2'
                }`}></div>
              </div>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(loc.captured_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-l-transparent border-r-transparent border-t-black"></div>
              </div>
            </div>
          </Marker>
        ))}
      </Map>

      {/* Map info overlay */}
      {showPath && employeeLocations.length > 0 && (
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="text-sm font-medium text-gray-800 mb-2">Movement Path</div>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Start</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>End</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
              <span>Attendance</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-[#006DA8] rounded-full"></div>
              <span>Path ({employeeLocations.length} points)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Ensure component is only rendered client-side
export default dynamic(() => Promise.resolve(MapboxMap), {
  ssr: false
});

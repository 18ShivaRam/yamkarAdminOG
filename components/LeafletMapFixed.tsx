"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from 'next/dynamic';
import L from "leaflet";
import 'leaflet/dist/leaflet.css';
import { EmployeeLocation, fetchEmployeeLocations, fetchLatestEmployeeLocation } from '@/lib/supabaseClient';

// Fix Leaflet marker icon paths
const fixLeafletIcons = () => {
  if ((L.Icon.Default as any).initialized) return;
  
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
  
  (L.Icon.Default as any).initialized = true;
};

interface LeafletMapProps {
  employeeId: string;
  location?: { lat: number; lng: number } | string | null;
  showPath?: boolean;
  attendanceLogId?: string;
  containerType?: 'current-location' | 'movement-path';
}

const DEFAULT_LOCATION = { lat: 23.0225, lng: 72.5714 }; // Ahmedabad

const LeafletMapFixed: React.FC<LeafletMapProps> = ({ 
  employeeId,
  location,
  showPath = false,
  attendanceLogId,
  containerType = 'current-location'
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [employeeLocations, setEmployeeLocations] = useState<EmployeeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [noLocationData, setNoLocationData] = useState(false);
  const mounted = useRef(false);

  // Initialize component
  useEffect(() => {
    mounted.current = true;
    fixLeafletIcons();
    
    return () => {
      mounted.current = false;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
          mapRef.current = null;
        } catch (err) {
          console.error('Error cleaning up map:', err);
        }
      }
    };
  }, []);

  // Fetch location data
  useEffect(() => {
    const fetchData = async () => {
      if (!mounted.current) return;
      
      setLoading(true);
      setError(null);
      
      try {
        if (showPath && attendanceLogId) {
          // Fetch movement path data
          const locations = await fetchEmployeeLocations(attendanceLogId, false);
          if (mounted.current) {
            if (locations && locations.length > 0) {
              setEmployeeLocations(locations);
              setCoords([locations[0].latitude, locations[0].longitude]);
              setNoLocationData(false);
            } else {
              setNoLocationData(true);
              setEmployeeLocations([]);
            }
          }
        } else if (location) {
          // Use provided location
          if (typeof location === 'string') {
            const parts = location.split(',');
            if (parts.length === 2) {
              const lat = parseFloat(parts[0]);
              const lng = parseFloat(parts[1]);
              if (!isNaN(lat) && !isNaN(lng)) {
                setCoords([lat, lng]);
                setNoLocationData(false);
              }
            }
          } else if (location && typeof location === 'object' && 'lat' in location && 'lng' in location) {
            setCoords([location.lat, location.lng]);
            setNoLocationData(false);
          }
        } else {
          // Fetch latest location
          const latest = await fetchLatestEmployeeLocation(employeeId);
          if (mounted.current) {
            if (latest) {
              setCoords([latest.latitude, latest.longitude]);
              setNoLocationData(false);
            } else {
              setNoLocationData(true);
              setCoords(null);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching location data:', err);
        if (mounted.current) {
          setError(`Failed to load location data: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setNoLocationData(true);
        }
      } finally {
        if (mounted.current) {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [employeeId, location, showPath, attendanceLogId]);

  // Initialize map when coordinates are available
  useEffect(() => {
    if (!coords || !containerRef.current || !mounted.current) return;

    // Clean up existing map
    if (mapRef.current) {
      try {
        mapRef.current.remove();
        mapRef.current = null;
      } catch (err) {
        console.error('Error removing existing map:', err);
      }
    }

    const createMap = () => {
      if (!mounted.current || !containerRef.current || !coords) return;

      const container = containerRef.current;
      
      // Check if container already has a map and clean it up
      if ((container as any)._leaflet_id) {
        try {
          delete (container as any)._leaflet_id;
          container.innerHTML = '';
        } catch (err) {
          console.error('Error cleaning container:', err);
        }
      }

      // Ensure container has proper dimensions
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        console.warn('Container has no dimensions, retrying...');
        setTimeout(() => {
          if (mounted.current) {
            createMap();
          }
        }, 200);
        return;
      }

      try {
        const map = L.map(container, {
          center: coords,
          zoom: 15,
          zoomControl: true,
          attributionControl: true,
          preferCanvas: true,
          closePopupOnClick: true,
          trackResize: true
        });
        
        // Ensure Leaflet container doesn't interfere with modals
        const mapContainer = map.getContainer();
        if (mapContainer) {
          mapContainer.style.zIndex = '1';
          mapContainer.style.position = 'relative';
        }
        
        // Add error handling for map events
        map.on('error', (e) => {
          console.warn('Leaflet map error:', e);
        });
        
        map.on('popupopen', (e) => {
          try {
            // Ensure popup container is properly sized
            setTimeout(() => {
              if (map && map.getContainer()) {
                map.invalidateSize();
              }
            }, 50);
          } catch (err) {
            console.warn('Error handling popup open:', err);
          }
        });

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        if (showPath && employeeLocations.length > 0) {
          // Render movement path
          const sortedLocations = [...employeeLocations].sort(
            (a, b) => new Date(a.created_at || a.captured_at).getTime() - new Date(b.created_at || b.captured_at).getTime()
          );

          // Create polyline
          const polylinePoints = sortedLocations.map(loc => [loc.latitude, loc.longitude] as [number, number]);
          L.polyline(polylinePoints, {
            color: '#228B22',
            weight: 4,
            opacity: 0.7
          }).addTo(map);

          // Add markers for start and end points
          if (sortedLocations.length > 0) {
            // Start marker (green with pulsing effect)
            const startMarker = L.marker([sortedLocations[0].latitude, sortedLocations[0].longitude]);
            startMarker.addTo(map);
            
            // Add popup with error handling
            try {
              startMarker.bindPopup('Start Location', {
                closeButton: true,
                autoClose: true,
                closeOnEscapeKey: true
              });
            } catch (err) {
              console.warn('Error binding popup to start marker:', err);
            }

            // End marker (red) if more than one location
            if (sortedLocations.length > 1) {
              const lastLocation = sortedLocations[sortedLocations.length - 1];
              const endMarker = L.marker([lastLocation.latitude, lastLocation.longitude]);
              endMarker.addTo(map);
              
              // Add popup with error handling
              try {
                endMarker.bindPopup('End Location', {
                  closeButton: true,
                  autoClose: true,
                  closeOnEscapeKey: true
                });
              } catch (err) {
                console.warn('Error binding popup to end marker:', err);
              }
            }
          }

          // Fit map to show all locations
          if (polylinePoints.length > 0) {
            map.fitBounds(polylinePoints);
          }
        } else {
          // Single location marker with highlighted effect
          const marker = L.marker(coords);
          marker.addTo(map);
          
          // Add popup with error handling
          try {
            marker.bindPopup('Current Location', {
              closeButton: true,
              autoClose: true,
              closeOnEscapeKey: true,
              maxWidth: 200
            });
          } catch (err) {
            console.warn('Error binding popup to current location marker:', err);
          }
        }

        mapRef.current = map;
        setError(null);
        
        // Force map to invalidate size after creation
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 100);
        
      } catch (err) {
        console.error('Error creating map:', err);
        if (mounted.current) {
          setError(`Failed to initialize map: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    };

    // Create map with a small delay
    setTimeout(() => {
      createMap();
    }, 100);

  }, [coords, employeeLocations, showPath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg border border-red-200">
        <div className="text-center text-red-600">
          <p className="font-medium">Map Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (noLocationData) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center text-gray-500">
          <p className="font-medium">No Location Data</p>
          <p className="text-sm mt-1">
            {showPath ? 'No movement data available for today' : 'No current location available'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-64 rounded-lg overflow-hidden border border-gray-200 relative" style={{ zIndex: 1 }}>
      <div 
        ref={containerRef} 
        className="w-full h-full relative" 
        style={{ zIndex: 1, position: 'relative' }}
      />
    </div>
  );
};

// Ensure component is only rendered client-side
export default dynamic(() => Promise.resolve(LeafletMapFixed), {
  ssr: false
});

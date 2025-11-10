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

const LeafletMapSimple: React.FC<LeafletMapProps> = ({ 
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

  // Create map function to handle retries
  const createMapInstance = () => {
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

    // Ensure container has proper dimensions before creating map
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      console.warn('Container has no dimensions, retrying...');
      setTimeout(() => {
        if (mounted.current) {
          createMapInstance();
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
        preferCanvas: true
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
          L.marker([sortedLocations[0].latitude, sortedLocations[0].longitude], {
            icon: L.divIcon({
              className: 'custom-div-icon',
              html: `
                <div style="position: relative;">
                  <div style="background-color: #22c55e; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 rgba(34, 197, 94, 0.4); animation: pulse-green 1.5s infinite; position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">S</div>
                </div>
                <style>
                  @keyframes pulse-green {
                    0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
                  }
                </style>
              `,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })
          }).addTo(map).bindPopup('Start Location');

          // End marker (red with pulsing effect) if more than one location
          if (sortedLocations.length > 1) {
            const lastLocation = sortedLocations[sortedLocations.length - 1];
            L.marker([lastLocation.latitude, lastLocation.longitude], {
              icon: L.divIcon({
                className: 'custom-div-icon',
                html: `
                  <div style="position: relative;">
                    <div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 rgba(239, 68, 68, 0.4); animation: pulse-red 1.5s infinite; position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">E</div>
                  </div>
                  <style>
                    @keyframes pulse-red {
                      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                      70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                    }
                  </style>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })
            }).addTo(map).bindPopup('End Location');
          }
        }

        // Fit map to show all locations
        if (polylinePoints.length > 0) {
          map.fitBounds(polylinePoints);
        }
      } else {
        // Single location marker with highlighted pulsing effect
        L.marker(coords, {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: `
              <div style="position: relative;">
                <div style="background-color: #3b82f6; width: 28px; height: 28px; border-radius: 50%; border: 4px solid white; box-shadow: 0 0 0 rgba(59, 130, 246, 0.4); animation: pulse-blue 2s infinite; position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">📍</div>
              </div>
              <style>
                @keyframes pulse-blue {
                  0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
                  70% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); }
                  100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
                }
              </style>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
        }).addTo(map).bindPopup('Current Location');
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

    // Create map with a small delay to ensure DOM is ready
    setTimeout(() => {
      createMapInstance();
    }, 100);

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
            // Start marker (green)
            L.marker([sortedLocations[0].latitude, sortedLocations[0].longitude], {
              icon: L.divIcon({
                className: 'custom-div-icon',
                html: '<div style="background-color: #22c55e; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px;">S</div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })
            }).addTo(map).bindPopup('Start Location');

            // End marker (red) if more than one location
            if (sortedLocations.length > 1) {
              const lastLocation = sortedLocations[sortedLocations.length - 1];
              L.marker([lastLocation.latitude, lastLocation.longitude], {
                icon: L.divIcon({
                  className: 'custom-div-icon',
                  html: '<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px;">E</div>',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                })
              }).addTo(map).bindPopup('End Location');
            }
          }

          // Fit map to show all locations
          if (polylinePoints.length > 0) {
            map.fitBounds(polylinePoints);
          }
        } else {
          // Single location marker
          L.marker(coords).addTo(map).bindPopup('Current Location');
        }

        mapRef.current = map;
        setError(null);
      }, 100);
    } catch (err) {
      console.error('Error creating map:', err);
      if (mounted.current) {
        setError(`Failed to initialize map: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
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
    <div className="w-full h-64 rounded-lg overflow-hidden border border-gray-200">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

// Ensure component is only rendered client-side
export default dynamic(() => Promise.resolve(LeafletMapSimple), {
  ssr: false
});

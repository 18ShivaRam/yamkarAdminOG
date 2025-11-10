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

const LeafletMap: React.FC<LeafletMapProps> = ({ 
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
  const [todayLocationsCount, setTodayLocationsCount] = useState<number | null>(null);
  const mounted = useRef(false);
  const mapInstanceId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const [visibilityKey, setVisibilityKey] = useState<number>(Date.now()); // Add a key for visibility changes
  const lastMapUpdate = useRef<number>(0);
  const [isEmergencyMapActive, setIsEmergencyMapActive] = useState(false);

  // Improve containerType handling with a ref to persist during state updates
  const containerTypeRef = useRef(containerType);
  
  // Log the container type immediately on creation to help with debugging
  console.log(`LeafletMap created with explicit containerType: ${containerType}`);
  
  // Update ref whenever prop changes
  useEffect(() => {
    if (containerTypeRef.current !== containerType) {
      console.log(`Container type changed from ${containerTypeRef.current} to ${containerType}`);
      containerTypeRef.current = containerType;
    }
  }, [containerType]);

  // Add a lastFetchTime ref to track when we last fetched data
  const lastFetchTime = useRef<number>(Date.now());
  
  // Add a function to check if we should refresh data
  const shouldRefreshData = () => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    // Refresh if it's been more than 30 seconds
    return timeSinceLastFetch > 30000;
  };

  // Add a function to refresh data
  const refreshData = async () => {
    try {
      if (showPath && attendanceLogId) {
        console.log('Refreshing location data...');
        const todayRecords = await fetchEmployeeLocations(attendanceLogId, false);
        if (mounted.current) {
          setTodayLocationsCount(todayRecords.length);
          if (todayRecords && todayRecords.length > 0) {
            setCoords([todayRecords[0].latitude, todayRecords[0].longitude]);
            setEmployeeLocations(todayRecords);
            setNoLocationData(false);
          }
        }
      } else if (employeeId) {
        const latest = await fetchLatestEmployeeLocation(employeeId);
        if (mounted.current && latest) {
          setCoords([latest.latitude, latest.longitude]);
        }
      }
      lastFetchTime.current = Date.now();
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  // Modify the tab observer
  useEffect(() => {
    const observeTabPanels = () => {
      try {
        const observer = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'data-state' || 
                 mutation.attributeName === 'aria-selected' ||
                 mutation.attributeName === 'style')) {
              
              const target = mutation.target as HTMLElement;
              const containerType = target.getAttribute('data-tab');
              
              if (containerType === containerTypeRef.current) {
                const isVisible = window.getComputedStyle(target).display !== 'none';
                console.log(`[Tab] Panel ${containerType} visibility changed to ${isVisible ? 'visible' : 'hidden'}`);
                
                if (isVisible) {
                  // Check cached data first
                  if (showPath && attendanceLogId) {
                    const cacheKey = `map_locations_${attendanceLogId}_${new Date().toISOString().split('T')[0]}`;
                    try {
                      const cachedData = localStorage.getItem(cacheKey);
                      if (cachedData) {
                        const parsedData = JSON.parse(cachedData);
                        console.log(`[Cache] Found ${parsedData.length} locations in cache on tab switch`);
                        
                        if (Array.isArray(parsedData) && parsedData.length === 0) {
                          console.log('[State] No locations in cache, showing no data message');
                          setNoLocationData(true);
                          setLoading(false);
                          return;
                        }
                      }
                    } catch (e) {
                      console.error('[Cache] Error checking cache on tab switch:', e);
                    }
                  }

                  // If we have locations in state, show them immediately
                  if (employeeLocations.length > 0) {
                    console.log(`[State] Using ${employeeLocations.length} locations from state`);
                    setNoLocationData(false);
                    setLoading(false);
                    
                    // Clear existing map and create new one
                    if (mapRef.current) {
                      try {
                        mapRef.current.remove();
                        mapRef.current = null;
                      } catch (e) { /* ignore */ }
                    }

                    const container = document.querySelector(`[data-map-id="${getMapId()}"]`);
                    if (container) {
                      console.log('[Map] Creating map with existing locations');
                      createMapInContainer(container as HTMLElement, employeeLocations);
                    }
                  } else if (!noLocationData) {
                    // Only refresh if we haven't already determined there's no data
                    console.log('[State] No locations in state, checking if refresh needed');
                    if (shouldRefreshData()) {
                      console.log('[API] Refreshing data on tab switch');
                      refreshData();
                    }
                  }
                }
              }
            }
          });
        });
        
        // Observe both tab panels and triggers
        const tabPanels = document.querySelectorAll('[role="tabpanel"]');
        const tabTriggers = document.querySelectorAll('[role="tab"]');
        const config = { attributes: true, childList: false, subtree: false };
        
        tabPanels.forEach(panel => observer.observe(panel, config));
        tabTriggers.forEach(tab => observer.observe(tab, config));
        
        return () => observer.disconnect();
      } catch (e) {
        console.error('[Error] Error setting up tab observer:', e);
      }
    };

    // Start observing immediately
    observeTabPanels();
  }, [containerTypeRef.current, employeeLocations, noLocationData]);

  // Modify the visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mounted.current) {
        // Reset loading state immediately
        setLoading(false);
        
        // Clear existing map
        if (mapRef.current) {
          try {
            mapRef.current.remove();
            mapRef.current = null;
          } catch (err) {
            console.error('Error removing map on visibility change:', err);
          }
        }

        // Force immediate map creation
        const container = document.querySelector(`[data-map-id="${getMapId()}"]`);
        if (container) {
          createMapInContainer(container as HTMLElement, employeeLocations);
        } else {
          createEmergencyMap(employeeLocations);
        }

        // Refresh data if needed
        if (shouldRefreshData()) {
          refreshData();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [employeeId, showPath, attendanceLogId, employeeLocations]);

  // Cache locations for persistence across refreshes
  useEffect(() => {
    if (showPath && attendanceLogId && employeeLocations && employeeLocations.length > 0) {
      try {
        const cacheKey = `map_locations_${attendanceLogId}_${new Date().toISOString().split('T')[0]}`;
        localStorage.setItem(cacheKey, JSON.stringify(employeeLocations));
        console.log(`Cached ${employeeLocations.length} locations for key ${cacheKey}`);
      } catch (e) {
        console.error("Error caching locations:", e);
      }
    }
  }, [employeeLocations, attendanceLogId, showPath]);

  // Separate function to render movement path that can be called from multiple places
  const renderMovementPath = (map: L.Map, locations: EmployeeLocation[]) => {
    try {
      if (!map || !locations || locations.length === 0) {
        console.error("Cannot render path: missing map or locations");
        return;
      }
      
      console.log(`Rendering movement path with ${locations.length} points`);
      
      // Sort locations by creation timestamp
      const timeOrderedLocations = [...locations].sort(
        (a, b) => new Date(a.created_at || a.captured_at).getTime() - new Date(b.created_at || b.captured_at).getTime()
      );
      
      // Get polyline points from time-ordered locations
      const polylinePoints = timeOrderedLocations.map(loc => [loc.latitude, loc.longitude]);
      
      // Create the polyline with the base path
      const polyline = L.polyline(polylinePoints as [number, number][], {
        color: '#228B22',
        weight: 4,
        opacity: 0.7
      }).addTo(map);
      
      // Add numbered markers for each location point based on time order
      timeOrderedLocations.forEach((loc, index) => {
        const markerPosition: [number, number] = [loc.latitude, loc.longitude];
        
        // Use different icons for start, end, and middle points (based on time order)
        let icon;
        if (index === 0) {
          icon = L.divIcon({
            className: 'custom-div-icon',
            html: `
              <div style="position: relative;">
                <div style="background-color: #22c55e; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 rgba(34, 197, 94, 0.4); animation: pulse-green 1.5s infinite; position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">1</div>
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
          });
        } else if (index === timeOrderedLocations.length - 1) {
          icon = L.divIcon({
            className: 'custom-div-icon',
            html: `
              <div style="position: relative;">
                <div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 rgba(239, 68, 68, 0.4); animation: pulse-red 1.5s infinite; position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">${index+1}</div>
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
          });
        } else {
          icon = L.divIcon({
            className: 'custom-div-icon',
            html: `
              <div style="position: relative;">
                <div style="background-color: #f97316; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px;">${index+1}</div>
              </div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
        }
        
        const marker = L.marker(markerPosition, { icon }).addTo(map);
        
        // Format the timestamp
        const captureTime = new Date(loc.captured_at);
        const timeString = captureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateString = captureTime.toLocaleDateString();
        
        // Add when it was created to the popup
        const createdTime = loc.created_at ? new Date(loc.created_at) : null;
        const createdTimeString = createdTime ? createdTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
        const createdDateString = createdTime ? createdTime.toLocaleDateString() : 'N/A';
        
        // Add popup with more detailed information
        marker.bindPopup(`<div class="text-xs font-medium p-1">
          <div>Location ID: ${loc.id || 'N/A'}</div>
          <div class="font-bold" style="color: ${index === 0 ? '#22c55e' : index === timeOrderedLocations.length - 1 ? '#ef4444' : '#f97316'}">
            ${index === 0 ? '🟢 FIRST POINT (START)' : index === timeOrderedLocations.length - 1 ? '🔴 LAST POINT (END)' : `📍 Middle Point`}
          </div>
          <div class="font-bold" style="color: #333;">Sequence Number: ${index + 1} of ${timeOrderedLocations.length}</div>
          <div>Date captured: ${dateString}</div>
          <div>Time captured: ${timeString}</div>
          <div>Date created: ${createdDateString}</div>
          <div>Time created: ${createdTimeString}</div>
          <div>Coords: ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}</div>
        </div>`);
      });
      
      // Fit map to show all points with padding
      if (polylinePoints.length > 0) {
        map.fitBounds(polyline.getBounds(), { 
          padding: [50, 50],
          maxZoom: 15 // Limit max zoom to keep context
        });
      }
      
      // Force map to update size
      setTimeout(() => {
        map.invalidateSize(true);
      }, 200);
    } catch (err) {
      console.error("Error rendering movement path:", err);
    }
  };

  // Modify the useEffect for data processing to ensure container exists
  useEffect(() => {
    // Reset states when component remounts or key changes
    setError(null);
    setLoading(true);
    setNoLocationData(false);
    
    mounted.current = true;
    console.log(`LeafletMap instance ${mapInstanceId.current} mounted for employee ${employeeId}, showPath=${showPath}, attendanceLogId=${attendanceLogId || 'none'}, key=${visibilityKey}, container=${containerType}`);
    
    // Fix Leaflet icons issue
    fixLeafletIcons();
    
    // Destroy any existing map to prevent duplicate instances
    if (mapRef.current) {
      try {
        mapRef.current.remove();
        mapRef.current = null;
      } catch (err) {
        console.error(`Error removing existing map:`, err);
      }
    }
    
    const processLocationData = async () => {
      try {
        // For path view, prioritize loading the path data
        if (showPath && attendanceLogId) {
          const cacheKey = `map_locations_${attendanceLogId}_${new Date().toISOString().split('T')[0]}`;
          let todayRecords: EmployeeLocation[] = [];
          
          // First check cache
          try {
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
              const parsedData = JSON.parse(cachedData);
              if (Array.isArray(parsedData)) {
                console.log(`[Cache] Found ${parsedData.length} cached locations for today`);
                todayRecords = parsedData;
              }
            }
          } catch (e) {
            console.error("[Cache] Error reading cache:", e);
          }

          // If no cached data, fetch from API
          if (todayRecords.length === 0) {
            console.log('[API] No cached data, fetching from API');
            todayRecords = await fetchEmployeeLocations(attendanceLogId, false);
            
            // Cache the new data
            if (todayRecords.length > 0) {
              try {
                localStorage.setItem(cacheKey, JSON.stringify(todayRecords));
                console.log(`[Cache] Successfully cached ${todayRecords.length} locations`);
              } catch (e) {
                console.error("[Cache] Error caching locations:", e);
              }
            }
          }

          // Set state based on location count
          setTodayLocationsCount(todayRecords.length);
          console.log(`[Locations] Total locations for today: ${todayRecords.length}`);
          
          if (mounted.current) {
            if (todayRecords.length === 0) {
              console.log('[State] No locations found, showing no data message');
              setNoLocationData(true);
              setLoading(false);
              setEmployeeLocations([]);
              return;
            }

            // We have locations, proceed with map
            console.log('[State] Setting up map with locations');
            setCoords([todayRecords[0].latitude, todayRecords[0].longitude]);
            setEmployeeLocations(todayRecords);
            setNoLocationData(false);
            setLoading(false);

            // Create map with locations
            setTimeout(() => {
              if (mounted.current) {
                const container = containerRef.current || document.querySelector(`[data-map-id="${getMapId()}"]`);
                if (container) {
                  console.log('[Map] Creating map with locations');
                  createMapInContainer(container as HTMLElement, todayRecords);
                } else {
                  console.log('[Map] Container not found, map creation failed');
                }
              }
            }, 100);
          }
          return;
        }
        
        // For current location view
        if (typeof location === 'string' && location) {
          const parts = location.split(',');
          if (parts.length === 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
              console.log('[Location] Using provided location coordinates');
              setCoords([lat, lng]);
              setNoLocationData(false);
              setLoading(false);
              return;
            }
          }
        }
        
        if (location && typeof location === 'object' && 'lat' in location && 'lng' in location) {
          console.log('[Location] Using provided location object');
          setCoords([location.lat, location.lng]);
          setNoLocationData(false);
          setLoading(false);
          return;
        }

        // Fetch latest location if no location provided
        if (!location) {
          console.log('[API] Fetching latest location');
          const latest = await fetchLatestEmployeeLocation(employeeId);
          if (latest) {
            console.log('[Location] Latest location found');
            setCoords([latest.latitude, latest.longitude]);
            setNoLocationData(false);
          } else {
            console.log('[Location] No location data available');
            setNoLocationData(true);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error(`[Error] Error processing location data:`, err);
        if (mounted.current) {
          setError(`Failed to load location data: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setNoLocationData(true);
          setLoading(false);
        }
      }
    };

    processLocationData();

    return () => {
      console.log(`LeafletMap instance ${mapInstanceId.current} unmounting for employee ${employeeId}`);
      mounted.current = false;
      
      // Clear map on unmount
      if (mapRef.current) {
        try {
          mapRef.current.remove();
          mapRef.current = null;
        } catch (err) {
          console.error(`Error removing map ${mapInstanceId.current} on unmount:`, err);
        }
      }
    };
  }, [employeeId, location, showPath, attendanceLogId, visibilityKey, containerType]);

  // Initialize map when coordinates are available
  useEffect(() => {
    if (!mounted.current || !coords) {
      return;
    }

    // Clean up any existing map before creating a new one
    if (mapRef.current) {
      try {
        mapRef.current.remove();
        mapRef.current = null;
      } catch (err) {
        console.error(`Error removing existing map:`, err);
      }
    }

    // Force a small delay to ensure DOM is fully updated
    const initTimeout = setTimeout(() => {
      if (!mounted.current) return;

      const container = containerRef.current;
      if (!container) {
        console.error('Map container not found');
        return;
      }

      try {
        // Create new map instance
        const map = L.map(container, {
          center: coords,
          zoom: 13,
          zoomControl: true,
          attributionControl: true,
          fadeAnimation: true,
          markerZoomAnimation: true,
        });

        // Add tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          minZoom: 2
        }).addTo(map);

        // Add marker for current position if we're not showing a path
        if (!showPath) {
          L.marker(coords).addTo(map);
        }

        // Add path if showing path and we have locations
        if (employeeLocations.length > 0 && showPath) {
          renderMovementPath(map, employeeLocations);
        }

        // Store reference and update state
        mapRef.current = map;

        // Force map size update after a delay to ensure proper rendering
        setTimeout(() => {
          if (map && mounted.current) {
            map.invalidateSize(true);
          }
        }, 250);

        if (mounted.current) {
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        console.error('Error initializing map:', err);
        if (mounted.current) {
          setError(`Failed to initialize map: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setLoading(false);
        }
      }
    }, 100);

    return () => {
      clearTimeout(initTimeout);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
          mapRef.current = null;
        } catch (err) {
          console.error(`Error cleaning up map:`, err);
        }
      }
    };
  }, [coords, employeeId, showPath, employeeLocations, containerTypeRef.current]);

  // Create a more robust map container ID system based on both instance ID and container type
  useEffect(() => {
    // When containerType changes, we need to force a complete re-initialization
    if (mapRef.current) {
      try {
        mapRef.current.remove();
        mapRef.current = null;
      } catch (err) { /* ignore */ }
    }
    
    // Force a re-render with new visibility key when tab type changes
    setVisibilityKey(Date.now());
    
    // Update our ref
    containerTypeRef.current = containerType;
    console.log(`Container type changed to ${containerType}, forcing re-initialization`);
    
    // Reset emergency map flag
    setIsEmergencyMapActive(false);
  }, [containerType]);

  // Create a more specific ID for the map container based on both instance ID and container type
  const getMapId = () => `${mapInstanceId.current}-${containerTypeRef.current}`;

  // Update how we select map containers to use the complete ID
  const createEmergencyMap = (locations: EmployeeLocation[] = []) => {
    try {
      // Check if we already have an emergency map active
      if (isEmergencyMapActive) {
        console.log("Emergency map already active, skipping creation");
        return true;
      }
      
      // Set flag to prevent duplicate maps
      setIsEmergencyMapActive(true);
      
      // Get the current containerType from the ref for consistency
      const currentContainerType = containerTypeRef.current;
      console.log(`Creating emergency map for container type: ${currentContainerType}`);
      
      // Generate the complete map ID for this container type
      const fullMapId = getMapId();
      
      // Log the IDs we're using to help with debugging
      console.log(`Searching for container with data-map-id="${fullMapId}"`);
      
      // Do a more thorough cleanup of existing map elements
      document.querySelectorAll('.leaflet-container').forEach(elm => {
        try {
          elm.remove();
        } catch (e) { /* ignore */ }
      });
      
      // Also remove any previous emergency containers
      document.querySelectorAll('[id^="fallback-"]').forEach(container => {
        try {
          container.remove();
        } catch (e) { /* ignore */ }
      });
      
      // Look for container using more specific selector with the complete map ID
      const mapContainer = document.querySelector(`[data-map-id="${fullMapId}"]`);
      
      if (!mapContainer) {
        console.error(`Cannot find map container for emergency creation (ID: ${fullMapId}, type: ${currentContainerType})`);
        
        // Try to find the wrapper first
        const wrapperId = `map-wrapper-${visibilityKey}-${currentContainerType}`;
        const wrapper = document.getElementById(wrapperId);
        
        if (wrapper) {
          console.log(`Found wrapper ${wrapperId}, creating emergency container inside it`);
          
          // Clear wrapper
          wrapper.innerHTML = '';
          
          // Create container
          const emergencyContainer = document.createElement('div');
          emergencyContainer.setAttribute('data-map-id', fullMapId);
          emergencyContainer.setAttribute('data-emergency', 'true');
          emergencyContainer.className = 'h-full w-full';
          emergencyContainer.style.width = '100%';
          emergencyContainer.style.height = '350px';
          emergencyContainer.style.display = 'block';
          emergencyContainer.style.visibility = 'visible';
          
          wrapper.appendChild(emergencyContainer);
          
          // Now try to create the map in this container
          return createMapInContainer(emergencyContainer, locations);
        }
        
        // CRITICAL FIX: Create container if it doesn't exist
        console.log("Creating fallback container for map");
        const fallbackId = `fallback-${Math.random().toString(36).substring(2, 9)}`;
        
        // Find a better location to insert the fallback based on containerType
        let targetContainer;
        
        // Look for tab-specific containers
        if (currentContainerType === 'current-location') {
          // Try to find current location specific containers
          targetContainer = document.querySelector('[data-tab="current-location"]') || 
                            document.querySelector('.current-location-container') ||
                            document.querySelector('[role="tabpanel"][aria-selected="true"]');
        } else {
          // Try to find movement path specific containers
          targetContainer = document.querySelector('[data-tab="movement-path"]') || 
                            document.querySelector('.movement-path-container') ||
                            document.querySelector('[role="tabpanel"][aria-selected="true"]');
        }
        
        // If specific container not found, try more generic options
        if (!targetContainer) {
          const tabPanels = document.querySelectorAll('[role="tabpanel"]');
          // Try to get the active tab panel
          tabPanels.forEach(panel => {
            if (window.getComputedStyle(panel).display !== 'none') {
              targetContainer = panel;
            }
          });
          
          // If still not found, fall back to general containers
          if (!targetContainer) {
            const mainContent = document.querySelector('main') || document.querySelector('.main-content');
            targetContainer = mainContent || document.body;
          }
        }
        
        // Log what container we found
        console.log(`Using fallback container:`, targetContainer);
        
        // Create container that fits within the app layout instead of overlay
        const fallbackContainer = document.createElement('div');
        fallbackContainer.id = fallbackId;
        fallbackContainer.setAttribute('data-map-id', fullMapId);
        fallbackContainer.setAttribute('data-container-type', currentContainerType);
        fallbackContainer.setAttribute('data-tab-content', 'true');
        fallbackContainer.setAttribute('role', 'tabpanel');
        fallbackContainer.className = `map-container ${currentContainerType}-map w-full`;
        
        // Make the fallback container fully visible with important flags
        fallbackContainer.style.display = 'block !important';
        fallbackContainer.style.visibility = 'visible !important';
        fallbackContainer.style.opacity = '1 !important';
        fallbackContainer.style.height = '350px !important';
        fallbackContainer.style.width = '100% !important';
        fallbackContainer.style.zIndex = '100';
        fallbackContainer.style.backgroundColor = '#f0f0f0';
        fallbackContainer.style.border = '1px solid #ddd';
        fallbackContainer.style.borderRadius = '4px';
        fallbackContainer.style.overflow = 'hidden';
        
        // Style it to fit in the existing layout, not as a fixed overlay
        if (targetContainer === document.body) {
          // Only use fixed positioning if we have to add to body
          fallbackContainer.style.position = 'fixed';
          fallbackContainer.style.top = '50%';
          fallbackContainer.style.left = '50%';
          fallbackContainer.style.transform = 'translate(-50%, -50%)';
          fallbackContainer.style.maxWidth = '90%';
          
          // Only add close button if we're in a modal/overlay situation
          const closeButtonWrapper = document.createElement('div');
          closeButtonWrapper.style.position = 'absolute';
          closeButtonWrapper.style.top = '10px';
          closeButtonWrapper.style.right = '10px';
          closeButtonWrapper.style.zIndex = '1001';
          closeButtonWrapper.style.backgroundColor = 'white';
          closeButtonWrapper.style.borderRadius = '50%';
          closeButtonWrapper.style.width = '30px';
          closeButtonWrapper.style.height = '30px';
          closeButtonWrapper.style.display = 'flex';
          closeButtonWrapper.style.alignItems = 'center';
          closeButtonWrapper.style.justifyContent = 'center';
          closeButtonWrapper.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
          closeButtonWrapper.style.cursor = 'pointer';
          
          const closeButton = document.createElement('span');
          closeButton.innerHTML = '×';
          closeButton.style.fontSize = '24px';
          closeButton.style.lineHeight = '1';
          closeButton.style.fontWeight = 'bold';
          closeButton.style.color = '#666';
          
          closeButtonWrapper.appendChild(closeButton);
          fallbackContainer.appendChild(closeButtonWrapper);
          
          // Add event listener to close button
          closeButtonWrapper.addEventListener('click', () => {
            try {
              console.log("Closing emergency map");
              // First remove the map
              if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
              }
              // Then remove the container
              fallbackContainer.remove();
              
              // Reset the emergency map flag
              setIsEmergencyMapActive(false);
              
              // Force re-render to try normal initialization
              setVisibilityKey(Date.now());
          } catch (e) {
              console.error("Error closing emergency map:", e);
            }
          });
        } else {
          // Otherwise, use normal positioning within the parent
          fallbackContainer.style.position = 'relative';
          fallbackContainer.style.margin = '1rem auto';
          fallbackContainer.style.width = '100%';
        }
        
        fallbackContainer.style.height = '350px';
        fallbackContainer.style.zIndex = '100';
        fallbackContainer.style.backgroundColor = '#f0f0f0';
        fallbackContainer.style.border = '1px solid #ddd';
        fallbackContainer.style.borderRadius = '4px';
        fallbackContainer.style.overflow = 'hidden';
        
        // Add a header to indicate this is an emergency view only if we need to
        // distinguish the map in the current context
        if (targetContainer === document.body) {
          const header = document.createElement('div');
          header.style.padding = '8px';
          header.style.backgroundColor = '#e7f5e7';
          header.style.borderBottom = '1px solid #ccc';
          header.style.fontSize = '14px';
          header.style.fontWeight = 'bold';
          header.style.color = '#228B22';

          // Log the container type to help debug
          console.log(`Creating header for container type: ${currentContainerType}`);

          // Make title determination more explicit
          let mapTitle = 'Map';
          if (currentContainerType === 'current-location') {
            mapTitle = 'Current Location Map';
          } else if (currentContainerType === 'movement-path') {
            mapTitle = 'Movement Path Map';
          } else {
            // If containerType is not one of the expected values, infer from showPath
            mapTitle = showPath ? 'Movement Path Map' : 'Current Location Map';
          }

          header.textContent = mapTitle;
          fallbackContainer.appendChild(header);
        }
        
        // Add a div to contain the actual map
        const mapDiv = document.createElement('div');
        mapDiv.id = `map-content-${fallbackId}`;
        mapDiv.style.width = '100%';
        mapDiv.style.height = targetContainer === document.body ? 'calc(100% - 32px)' : '100%';
        
        fallbackContainer.appendChild(mapDiv);
        
        // Add it to the target container
        targetContainer.appendChild(fallbackContainer);
        
        // Create map in this fallback container
        setTimeout(() => {
          const container = document.getElementById(`map-content-${fallbackId}`);
          if (container) {
            return createMapInContainer(container, locations);
          }
          return false;
    }, 100);
    
        return false;
      }
      
      return createMapInContainer(mapContainer, locations);
    } catch (err) {
      console.error("Emergency map creation failed:", err);
      setIsEmergencyMapActive(false);
      return false;
    }
  };
  
  // Modify the createMapInContainer function to handle loading state
  const createMapInContainer = (container: Element, locations: EmployeeLocation[] = []) => {
    try {
      // Reset loading state immediately
      setLoading(false);
      
      // Ensure all parents are visible by walking up the DOM
      let parent = (container as HTMLElement).parentElement;
      while (parent) {
        // Force all parent elements to be visible
        parent.style.display = 'block';
        parent.style.visibility = 'visible';
        parent.style.opacity = '1';
        
        // Check for specific tab panel elements and make them active
        if (parent.getAttribute('role') === 'tabpanel') {
          parent.setAttribute('aria-selected', 'true');
          parent.style.display = 'block';
          
          // If this is a tabpanel, also make sure its tab is active
          const tabValue = parent.getAttribute('data-state');
          if (tabValue) {
            const tabTriggers = document.querySelectorAll('[role="tab"]');
            tabTriggers.forEach(tab => {
              if (tab.getAttribute('data-value') === tabValue) {
                tab.setAttribute('data-state', 'active');
                tab.setAttribute('aria-selected', 'true');
              }
            });
          }
        }
        
        parent = parent.parentElement;
      }
      
      // Ensure clean container
      (container as HTMLElement).innerHTML = '';
      
      // Style container aggressively to ensure visibility
      const containerElement = container as HTMLElement;
      
      // Force element to be fully visible and properly sized
      containerElement.style.width = '100%';
      containerElement.style.height = '350px';
      containerElement.style.position = 'relative';
      containerElement.style.display = 'block';
      containerElement.style.visibility = 'visible';
      containerElement.style.opacity = '1';
      containerElement.style.zIndex = '1000';
      containerElement.style.backgroundColor = '#f0f0f0';
      containerElement.style.overflow = 'hidden';
      
      // Log dimensions to help with debugging
      console.log(`Creating map in container (dims: ${containerElement.clientWidth}x${containerElement.clientHeight})`, containerElement);
      
      // Log container details
      console.log(`Map container details:`, {
        id: containerElement.id,
        dataMapId: containerElement.getAttribute('data-map-id'),
        containerType: containerElement.getAttribute('data-container-type'),
        width: containerElement.clientWidth,
        height: containerElement.clientHeight,
        display: window.getComputedStyle(containerElement).display,
        visibility: window.getComputedStyle(containerElement).visibility,
        parent: containerElement.parentElement?.tagName
      });
      
      // Create map with center point
      let mapCenter: [number, number];
      if (coords) {
        mapCenter = coords;
      } else if (locations && locations.length > 0) {
        mapCenter = [locations[0].latitude, locations[0].longitude];
      } else {
        mapCenter = [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng];
      }
      
      // Create a unique ID for the actual map element
      const mapElementId = `map-element-${Math.random().toString(36).substring(2, 9)}`;
      const mapElement = document.createElement('div');
      mapElement.id = mapElementId;
      mapElement.style.width = '100%';
      mapElement.style.height = '100%';
      containerElement.appendChild(mapElement);
      
      // First ensure container is in the visible DOM by checking offsetParent
      if (!containerElement.offsetParent) {
        console.warn('Container may not be visible in DOM - forcing display properties');
        containerElement.style.position = 'relative';
        containerElement.style.display = 'block';
        containerElement.style.visibility = 'visible';
        containerElement.style.opacity = '1';
        
        // Force the container into the visible viewport
        let currentElement = containerElement;
        let isHidden = false;
        
        // Walk up the DOM to check if any parent is hidden
        while (currentElement && currentElement !== document.body) {
          const style = window.getComputedStyle(currentElement);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
            isHidden = true;
            break;
          }
          currentElement = currentElement.parentElement as HTMLElement;
        }
        
        // If we're hidden in the DOM, create a temporary container
        if (isHidden) {
          console.warn('Container is hidden in DOM, creating temporary visible container');
          const tempContainer = document.createElement('div');
          tempContainer.style.position = 'fixed';
          tempContainer.style.top = '0';
          tempContainer.style.left = '0';
          tempContainer.style.width = '100%';
          tempContainer.style.height = '100%';
          tempContainer.style.zIndex = '10000';
          tempContainer.style.backgroundColor = '#fff';
          tempContainer.style.padding = '20px';
          
          const mapDiv = document.createElement('div');
          mapDiv.style.width = '100%';
          mapDiv.style.height = '350px';
          tempContainer.appendChild(mapDiv);
          
          document.body.appendChild(tempContainer);
          
          // Create map in temporary container
          createMapInTempContainer(mapDiv, locations, mapCenter);
          
          // Add close button
          const closeButton = document.createElement('button');
          closeButton.textContent = 'Close Map';
          closeButton.style.marginTop = '10px';
          closeButton.style.padding = '5px 10px';
          closeButton.style.backgroundColor = '#228B22';
          closeButton.style.color = 'white';
          closeButton.style.border = 'none';
          closeButton.style.borderRadius = '4px';
          closeButton.style.cursor = 'pointer';
          
          closeButton.addEventListener('click', () => {
            document.body.removeChild(tempContainer);
            if (mapRef.current) {
          mapRef.current.remove();
              mapRef.current = null;
            }
          });
          
          tempContainer.appendChild(closeButton);
          return true;
        }
      }
      
      // Wait a tiny bit to ensure DOM is ready
      setTimeout(() => {
        createMapInElement(mapElement, locations, mapCenter);
      }, 50);
      
      return true;
        } catch (err) {
      console.error("Error creating map in container:", err);
      return false;
    }
  };

  // Create map in a specified element
  const createMapInElement = (element: HTMLElement, locations: EmployeeLocation[], mapCenter: [number, number]) => {
    try {
      // Create new map instance with explicit options for reliability
      const map = L.map(element, {
        center: mapCenter,
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
      });
      
      // Add tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        minZoom: 3
      }).addTo(map);
      
      // Force size update immediately
      map.invalidateSize(true);
      
      // Store map reference
      mapRef.current = map;
      
      // Render path data if we have location data
      if (locations.length > 0 && showPath) {
        console.log("Adding path data to emergency map:", locations.length, "points");
        renderMovementPath(map, locations);
      } else if (!showPath) {
        // Add a simple marker for current location view
        L.marker(mapCenter).addTo(map);
      }
      
      // Force another size update after content is added
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize(true);
        }
      }, 200);
      
      // Force loading state to false
      setLoading(false);
      
      console.log("Map created successfully in container:", element.id);
      return true;
    } catch (e) {
      console.error("Error creating map:", e);
      return false;
    }
  };
  
  // Create map in temporary container
  const createMapInTempContainer = (element: HTMLElement, locations: EmployeeLocation[], mapCenter: [number, number]) => {
    try {
      createMapInElement(element, locations, mapCenter);
      // Add a notice that this is a fallback map
      const notice = document.createElement('div');
      notice.textContent = 'Fallback Map View - Container visibility issue detected';
      notice.style.backgroundColor = '#FFF3CD';
      notice.style.color = '#856404';
      notice.style.padding = '8px';
      notice.style.marginTop = '10px';
      notice.style.borderRadius = '4px';
      notice.style.fontSize = '14px';
      element.parentElement?.appendChild(notice);
      return true;
    } catch (e) {
      console.error("Error creating map in temp container:", e);
      return false;
    }
  };

  // Add a MutationObserver to detect tab panel changes
  useEffect(() => {
    // Function to handle tab panel visibility changes
    const observeTabPanels = () => {
      try {
        // Create a mutation observer to watch for tab changes
        const observer = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'data-state' || 
                 mutation.attributeName === 'aria-selected' ||
                 mutation.attributeName === 'style')) {
              
              const target = mutation.target as HTMLElement;
              const containerType = target.getAttribute('data-tab');
              
              // Check if this is our container type and it's now active
              if (containerType === containerTypeRef.current) {
                const isVisible = window.getComputedStyle(target).display !== 'none';
                console.log(`Tab panel for ${containerType} visibility changed to ${isVisible ? 'visible' : 'hidden'}`);
                
                if (isVisible) {
                  if (shouldRefreshData()) {
                    refreshData();
                  }
                  
                  // If our container is now visible, reinitialize the map
                  console.log('Our tab panel is now visible, forcing map redraw');
                  
                  // Force cleanup of any existing map
                  if (mapRef.current) {
                    try {
                      mapRef.current.remove();
        mapRef.current = null;
                    } catch (e) { /* ignore */ }
                  }
                  
                  // Force a redraw after a small delay
                  setTimeout(() => {
                    if (mounted.current) {
                      // Using emergency map creation as it's most reliable
                      createEmergencyMap(employeeLocations);
                    }
                  }, 100);
                }
              }
            }
          });
        });
        
        // Observe all tab panels
        const tabPanels = document.querySelectorAll('[role="tabpanel"]');
        const config = { attributes: true, childList: false, subtree: false };
        
        tabPanels.forEach(panel => {
          observer.observe(panel, config);
        });
        
        // Also observe all tab triggers
        const tabTriggers = document.querySelectorAll('[role="tab"]');
        tabTriggers.forEach(tab => {
          observer.observe(tab, config);
        });
        
        return () => {
          observer.disconnect();
        };
      } catch (e) {
        console.error('Error setting up tab observer:', e);
      }
    };
    
    // Start observing after a delay to let the DOM settle
    const timerId = setTimeout(observeTabPanels, 1000);
    
    return () => {
      clearTimeout(timerId);
    };
  }, [containerTypeRef.current, employeeLocations]); // Re-run if container type changes
  
  // Add direct DOM manipulation to force our tab to be active - this is a last resort approach
  useEffect(() => {
    const forceTabActive = () => {
      try {
        // Only do this if our map isn't showing
        if (mapRef.current) return;
        
        // Find all tab triggers
        const tabTriggers = Array.from(document.querySelectorAll('[role="tab"]'));
        
        // Find the trigger for our tab
        const ourTabTrigger = tabTriggers.find(tab => {
          // Look for the tab that would show our container type
          const value = tab.getAttribute('data-value');
          if (value === 'path' && containerTypeRef.current === 'movement-path') return true;
          if (value === 'current' && containerTypeRef.current === 'current-location') return true;
          return false;
        });
        
        if (ourTabTrigger) {
          console.log(`Found our tab trigger for ${containerTypeRef.current}:`, ourTabTrigger);
          
          // Check if our tab is already active
          const isActive = ourTabTrigger.getAttribute('data-state') === 'active';
          
          if (!isActive) {
            console.log(`Our tab is not active, manually activating it`);
            
            // Get all tab panels
            const tabPanels = document.querySelectorAll('[role="tabpanel"]');
            
            // Set all triggers and panels to inactive
            tabTriggers.forEach(trigger => {
              trigger.setAttribute('data-state', 'inactive');
              trigger.setAttribute('aria-selected', 'false');
            });
            
            tabPanels.forEach(panel => {
              panel.setAttribute('data-state', 'inactive');
              (panel as HTMLElement).style.display = 'none';
            });
            
            // Set our trigger and panel to active
            ourTabTrigger.setAttribute('data-state', 'active');
            ourTabTrigger.setAttribute('aria-selected', 'true');
            
            // Find our panel
            const dataValue = ourTabTrigger.getAttribute('data-value');
            const ourPanel = Array.from(tabPanels).find(panel => {
              return panel.getAttribute('data-state') === dataValue;
            });
            
            if (ourPanel) {
              console.log(`Found our panel, activating it`);
              ourPanel.setAttribute('data-state', 'active');
              (ourPanel as HTMLElement).style.display = 'block';
              
              // Force visibility on all our elements
              const ourMapContainer = ourPanel.querySelector(`[data-container-type="${containerTypeRef.current}"]`);
              if (ourMapContainer) {
                (ourMapContainer as HTMLElement).style.display = 'block';
                (ourMapContainer as HTMLElement).style.visibility = 'visible';
                (ourMapContainer as HTMLElement).style.opacity = '1';
                
                // Force map creation
                setTimeout(() => {
                  if (mounted.current) {
                    createEmergencyMap(employeeLocations);
                  }
                }, 100);
              }
            }
          }
        }
      } catch (e) {
        console.error('Error in forceTabActive:', e);
      }
    };
    
    // If we're in the movement path tab and no map is showing, try to force it
    if (containerTypeRef.current === 'movement-path' && !mapRef.current) {
      const timerId = setTimeout(forceTabActive, 1500);
      return () => clearTimeout(timerId);
    }
  }, [containerTypeRef.current, employeeLocations, visibilityKey]);
  
  return (
    <div 
      className={`relative h-full w-full ${containerTypeRef.current}-container`}
      id={`map-wrapper-${visibilityKey}-${containerTypeRef.current}`}
      key={`map-wrapper-${visibilityKey}-${containerTypeRef.current}`}
      data-tab={containerTypeRef.current}
      data-map-wrapper="true"
      data-visibility-key={visibilityKey}
      style={{ 
        minHeight: "350px",
        background: "#f0f0f0",
        display: "block",
        position: "relative", 
        zIndex: 1,
        visibility: "visible",
        opacity: 1
      }}
    >
      {noLocationData && !error && !loading && (
        <div className="h-full w-full flex items-center justify-center bg-gray-100 p-4">
          <div className="text-amber-600 text-center">
            <p className="font-medium">No location data available</p>
            <p className="text-sm mt-1">
              {showPath 
                ? "This employee has no movement history recorded today." 
                : "Location data will appear when the employee checks in."}
            </p>
          </div>
        </div>
      )}
      
      {loading && !error && !noLocationData && (
        <div className="h-full w-full flex items-center justify-center bg-gray-100">
          <div className="animate-spin h-8 w-8 border-4 border-[#228B22] border-opacity-50 border-t-[#228B22] rounded-full"></div>
        </div>
      )}
      
      {error && (
        <div className="h-full w-full flex items-center justify-center bg-gray-100 p-4">
          <div className="text-red-500 text-center">
            <p className="font-medium">Error loading map</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef}
        data-map-id={getMapId()}
        data-container-type={containerTypeRef.current}
        data-instance-id={mapInstanceId.current}
        data-visibility-key={visibilityKey}
        id={`map-container-${getMapId()}`}
        className="h-full w-full" 
        style={{
          height: '350px',
          width: '100%',
          position: 'relative',
          background: '#f0f0f0',
          visibility: 'visible',
          opacity: 1,
          overflow: 'hidden',
          zIndex: 10,
          display: (!noLocationData && !error && !loading) ? 'block' : 'none'
        }}
      />
      
      {/* Special marker to inject map directly if React approach fails */}
      <div 
        id={`emergency-container-${getMapId()}`}
        data-map-id={`emergency-${getMapId()}`}
        data-container-type={containerTypeRef.current}
        data-instance-id={mapInstanceId.current}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '350px',
          zIndex: 5,
          display: 'none'
        }}
      ></div>
      
      {/* Adding debug info in dev environment */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="hidden absolute bottom-0 right-0 bg-white text-xs p-1 rounded-tl">
          ContainerType: {containerTypeRef.current}, ID: {getMapId()}
        </div>
      )}
    </div>
  );
};

// Ensure component is only rendered client-side
export default dynamic(() => Promise.resolve(LeafletMap), {
  ssr: false
});
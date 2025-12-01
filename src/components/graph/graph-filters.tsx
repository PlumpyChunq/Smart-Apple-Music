'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { RelationshipType } from '@/types';

export interface GraphFilterState {
  relationshipTypes: Set<RelationshipType>;
  temporalFilter: 'all' | 'current';
  nodeTypes: Set<'person' | 'group'>;
  yearRange: { min: number; max: number } | null;  // null = show all years
}

interface GraphFiltersProps {
  filters: GraphFilterState;
  onFiltersChange: (filters: GraphFilterState) => void;
  availableTypes?: RelationshipType[];
  availableYearRange?: { min: number; max: number } | null;
  compact?: boolean;
}

// Configuration for each relationship type - colors match graph edge colors
const RELATIONSHIP_CONFIG: Record<RelationshipType, { label: string; color: string; defaultOn: boolean }> = {
  member_of: { label: 'Member', color: '#93c5fd', defaultOn: true },
  founder_of: { label: 'Founder', color: '#fcd34d', defaultOn: true },
  side_project: { label: 'Side Project', color: '#f9a8d4', defaultOn: true },
  collaboration: { label: 'Collab', color: '#6ee7b7', defaultOn: true },
  producer: { label: 'Producer', color: '#c4b5fd', defaultOn: true },
  touring_member: { label: 'Touring', color: '#9ca3af', defaultOn: false },
  same_label: { label: 'Label', color: '#9ca3af', defaultOn: false },
  same_scene: { label: 'Scene', color: '#9ca3af', defaultOn: false },
  influenced_by: { label: 'Influence', color: '#9ca3af', defaultOn: false },
};

// Default filter state
export function getDefaultFilters(): GraphFilterState {
  const defaultTypes = new Set<RelationshipType>();
  for (const [type, config] of Object.entries(RELATIONSHIP_CONFIG)) {
    if (config.defaultOn) {
      defaultTypes.add(type as RelationshipType);
    }
  }

  return {
    relationshipTypes: defaultTypes,
    temporalFilter: 'all',
    nodeTypes: new Set(['person', 'group']),
    yearRange: null,  // null = show all years (no filtering)
  };
}

export function GraphFilters({
  filters,
  onFiltersChange,
  availableTypes,
  availableYearRange,
  compact = false,
}: GraphFiltersProps) {
  // Filter to only show types that exist in the graph
  const visibleTypes = useMemo(() => {
    const allTypes = Object.keys(RELATIONSHIP_CONFIG) as RelationshipType[];
    if (!availableTypes || availableTypes.length === 0) return allTypes;
    return allTypes.filter(type => availableTypes.includes(type));
  }, [availableTypes]);

  const handleRelTypeToggle = (type: RelationshipType) => {
    const newTypes = new Set(filters.relationshipTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    onFiltersChange({ ...filters, relationshipTypes: newTypes });
  };

  const handleTemporalChange = (value: 'all' | 'current') => {
    onFiltersChange({ ...filters, temporalFilter: value });
  };

  const handleNodeTypeToggle = (type: 'person' | 'group') => {
    const newTypes = new Set(filters.nodeTypes);
    if (newTypes.has(type)) {
      // Don't allow deselecting both
      if (newTypes.size > 1) {
        newTypes.delete(type);
      }
    } else {
      newTypes.add(type);
    }
    onFiltersChange({ ...filters, nodeTypes: newTypes });
  };

  const handleSelectAll = () => {
    onFiltersChange({
      ...filters,
      relationshipTypes: new Set(visibleTypes),
    });
  };

  const handleSelectNone = () => {
    // Keep at least one type selected
    const firstType = visibleTypes[0];
    onFiltersChange({
      ...filters,
      relationshipTypes: new Set([firstType]),
    });
  };

  const handleYearRangeChange = (min: number, max: number) => {
    onFiltersChange({
      ...filters,
      yearRange: { min, max },
    });
  };

  const handleClearYearRange = () => {
    onFiltersChange({
      ...filters,
      yearRange: null,
    });
  };

  // Check if year filter is active
  const isYearFilterActive = filters.yearRange !== null;

  if (compact) {
    const handleReset = () => {
      onFiltersChange(getDefaultFilters());
    };

    // Check if current filters differ from defaults
    const defaults = getDefaultFilters();
    const isModified =
      filters.temporalFilter !== defaults.temporalFilter ||
      filters.relationshipTypes.size !== defaults.relationshipTypes.size ||
      ![...filters.relationshipTypes].every(t => defaults.relationshipTypes.has(t)) ||
      filters.yearRange !== null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1 flex-wrap text-[10px]">
          {visibleTypes.map((type) => {
            const config = RELATIONSHIP_CONFIG[type];
            const isActive = filters.relationshipTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => handleRelTypeToggle(type)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all ${
                  isActive
                    ? 'border-current'
                    : 'border-transparent opacity-30 hover:opacity-60'
                }`}
                style={isActive ? {
                  backgroundColor: `${config.color}20`,
                  borderColor: config.color,
                  color: config.color,
                } : undefined}
                title={`${isActive ? 'Hide' : 'Show'} ${config.label} relationships`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <span style={isActive ? { color: '#374151' } : undefined}>{config.label}</span>
              </button>
            );
          })}
          <span className="text-gray-200">|</span>
          <button
            onClick={() => handleTemporalChange(filters.temporalFilter === 'all' ? 'current' : 'all')}
            className={`px-1.5 py-0.5 rounded border transition-all ${
              filters.temporalFilter === 'current'
                ? 'border-green-400 bg-green-100 text-green-700'
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-100'
            }`}
            title={filters.temporalFilter === 'current' ? 'Showing current members only' : 'Showing all members (past + present)'}
          >
            {filters.temporalFilter === 'current' ? 'Current' : 'All Time'}
          </button>
          <button
            onClick={handleSelectAll}
            className="px-1.5 py-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Show all relationship types"
          >
            All
          </button>
          <button
            onClick={handleSelectNone}
            className="px-1.5 py-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Clear all filters (keeps only Member)"
          >
            Clear
          </button>
          {isModified && (
            <button
              onClick={handleReset}
              className="px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              title="Reset filters to defaults"
            >
              Reset
            </button>
          )}
        </div>

        {/* Year Range Slider */}
        {availableYearRange && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-gray-500 shrink-0">Year:</span>
            <YearRangeSlider
              min={availableYearRange.min}
              max={availableYearRange.max}
              value={filters.yearRange || availableYearRange}
              onChange={handleYearRangeChange}
              isActive={isYearFilterActive}
            />
            {isYearFilterActive && (
              <button
                onClick={handleClearYearRange}
                className="px-1.5 py-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                title="Show all years"
              >
                All Years
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Check if current filters differ from defaults for the reset button
  const defaults = getDefaultFilters();
  const isModified =
    filters.temporalFilter !== defaults.temporalFilter ||
    filters.relationshipTypes.size !== defaults.relationshipTypes.size ||
    ![...filters.relationshipTypes].every(t => defaults.relationshipTypes.has(t)) ||
    filters.nodeTypes.size !== defaults.nodeTypes.size ||
    ![...filters.nodeTypes].every(t => defaults.nodeTypes.has(t));

  const handleReset = () => {
    onFiltersChange(getDefaultFilters());
  };

  return (
    <div className="bg-white border rounded-lg p-3 space-y-3 text-sm">
      {/* Relationship Types */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-gray-700">Relationship Types</span>
          <div className="flex gap-1">
            <button
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleSelectNone}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              None
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {visibleTypes.map((type) => {
            const config = RELATIONSHIP_CONFIG[type];
            const isActive = filters.relationshipTypes.has(type);
            return (
              <label
                key={type}
                className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors border ${
                  isActive ? '' : 'border-transparent hover:bg-gray-50 opacity-50'
                }`}
                style={isActive ? {
                  backgroundColor: `${config.color}20`,
                  borderColor: config.color,
                } : undefined}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => handleRelTypeToggle(type)}
                  className="sr-only"
                />
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: isActive ? config.color : '#d1d5db' }}
                />
                <span className={isActive ? 'text-gray-900' : 'text-gray-400'}>
                  {config.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Temporal Filter */}
      <div className="border-t pt-3">
        <span className="font-medium text-gray-700 block mb-2">Time Period</span>
        <div className="flex gap-2">
          <button
            onClick={() => handleTemporalChange('all')}
            className={`flex-1 px-3 py-1.5 rounded border transition-colors ${
              filters.temporalFilter === 'all'
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => handleTemporalChange('current')}
            className={`flex-1 px-3 py-1.5 rounded border transition-colors ${
              filters.temporalFilter === 'current'
                ? 'bg-green-500 text-white border-green-500'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Current Only
          </button>
        </div>
      </div>

      {/* Node Type Filter */}
      <div className="border-t pt-3">
        <span className="font-medium text-gray-700 block mb-2">Show</span>
        <div className="flex gap-2">
          <label
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded border cursor-pointer transition-colors ${
              filters.nodeTypes.has('person')
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-white text-gray-400 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={filters.nodeTypes.has('person')}
              onChange={() => handleNodeTypeToggle('person')}
              className="sr-only"
            />
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Persons</span>
          </label>
          <label
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded border cursor-pointer transition-colors ${
              filters.nodeTypes.has('group')
                ? 'bg-blue-100 text-blue-800 border-blue-300'
                : 'bg-white text-gray-400 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={filters.nodeTypes.has('group')}
              onChange={() => handleNodeTypeToggle('group')}
              className="sr-only"
            />
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Groups</span>
          </label>
        </div>
      </div>

      {/* Reset Button */}
      {isModified && (
        <div className="border-t pt-3">
          <button
            onClick={handleReset}
            className="w-full px-3 py-1.5 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-sm"
          >
            Reset All Filters
          </button>
        </div>
      )}
    </div>
  );
}

// Year Range Slider Component
// Slider dimension constants
const SLIDER_TRACK_HEIGHT = 'h-1.5';
const SLIDER_ACTIVE_HEIGHT = 'h-2.5';
const SLIDER_HANDLE_SIZE = 'w-3.5 h-3.5';
const SLIDER_CONTAINER_HEIGHT = 'h-5';

interface YearRangeSliderProps {
  min: number;
  max: number;
  value: { min: number; max: number };
  onChange: (min: number, max: number) => void;
  isActive: boolean;
}

function YearRangeSlider({ min, max, value, onChange, isActive }: YearRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | 'range' | null>(null);
  const [focusedHandle, setFocusedHandle] = useState<'min' | 'max' | null>(null);
  const dragStartRef = useRef<{ clientX: number; min: number; max: number } | null>(null);

  const totalRange = max - min;
  const windowSize = value.max - value.min;
  const minPercent = totalRange > 0 ? ((value.min - min) / totalRange) * 100 : 0;
  const maxPercent = totalRange > 0 ? ((value.max - min) / totalRange) * 100 : 100;

  const getYearFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current) return min;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(min + percent * totalRange);
  }, [min, totalRange]);

  const handleMouseDown = useCallback((handle: 'min' | 'max' | 'range') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(handle);
    dragStartRef.current = { clientX: e.clientX, min: value.min, max: value.max };
  }, [value.min, value.max]);

  // Keyboard navigation for accessibility
  const handleKeyDown = useCallback((handle: 'min' | 'max') => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 5 : 1; // Hold shift for larger jumps
    let newMin = value.min;
    let newMax = value.max;

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        if (handle === 'min') {
          newMin = Math.max(min, value.min - step);
        } else {
          newMax = Math.max(value.min + 1, value.max - step);
        }
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        if (handle === 'min') {
          newMin = Math.min(value.max - 1, value.min + step);
        } else {
          newMax = Math.min(max, value.max + step);
        }
        break;
      case 'Home':
        e.preventDefault();
        if (handle === 'min') {
          newMin = min;
        } else {
          newMax = value.min + 1;
        }
        break;
      case 'End':
        e.preventDefault();
        if (handle === 'min') {
          newMin = value.max - 1;
        } else {
          newMax = max;
        }
        break;
      default:
        return;
    }

    onChange(newMin, newMax);
  }, [min, max, value, onChange]);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragging === 'range' && dragStartRef.current) {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const pixelsPerYear = rect.width / totalRange;
        const deltaPixels = e.clientX - dragStartRef.current.clientX;
        const deltaYears = Math.round(deltaPixels / pixelsPerYear);

        let newMin = dragStartRef.current.min + deltaYears;
        let newMax = dragStartRef.current.max + deltaYears;

        if (newMin < min) {
          newMin = min;
          newMax = min + windowSize;
        }
        if (newMax > max) {
          newMax = max;
          newMin = max - windowSize;
        }

        onChange(newMin, newMax);
      } else {
        const year = getYearFromPosition(e.clientX);
        if (dragging === 'min') {
          onChange(Math.min(year, value.max - 1), value.max);
        } else if (dragging === 'max') {
          onChange(value.min, Math.max(year, value.min + 1));
        }
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      dragStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, value, onChange, getYearFromPosition, min, max, totalRange, windowSize]);

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (dragging) return;
    const year = getYearFromPosition(e.clientX);
    const distToMin = Math.abs(year - value.min);
    const distToMax = Math.abs(year - value.max);
    if (distToMin < distToMax) {
      onChange(Math.min(year, value.max - 1), value.max);
    } else {
      onChange(value.min, Math.max(year, value.min + 1));
    }
  }, [dragging, value, onChange, getYearFromPosition]);

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0" role="group" aria-label="Year range filter">
      <span className={`text-[10px] font-medium tabular-nums ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
        {value.min}
      </span>
      <div
        ref={trackRef}
        className={`relative flex-1 ${SLIDER_CONTAINER_HEIGHT} cursor-pointer`}
        onClick={handleTrackClick}
      >
        {/* Background track */}
        <div className={`absolute top-1/2 -translate-y-1/2 left-0 right-0 ${SLIDER_TRACK_HEIGHT} bg-gray-200 rounded-full`} />

        {/* Active range - draggable middle bar */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 ${SLIDER_ACTIVE_HEIGHT} rounded-full transition-colors cursor-grab ${
            dragging === 'range' ? 'cursor-grabbing' : ''
          } ${isActive ? 'bg-blue-400 hover:bg-blue-500' : 'bg-gray-300 hover:bg-gray-400'}`}
          style={{
            left: `${minPercent}%`,
            right: `${100 - maxPercent}%`,
          }}
          onMouseDown={handleMouseDown('range')}
          title="Drag to move the entire range"
        >
          {isActive && windowSize >= 3 && (
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-white/90 pointer-events-none select-none">
              {windowSize}yr
            </span>
          )}
        </div>

        {/* Min handle */}
        <div
          role="slider"
          aria-label="Start year"
          aria-valuemin={min}
          aria-valuemax={value.max - 1}
          aria-valuenow={value.min}
          aria-valuetext={`${value.min}`}
          tabIndex={0}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 ${SLIDER_HANDLE_SIZE} rounded-full border-2 cursor-ew-resize transition-all z-10 ${
            dragging === 'min' || focusedHandle === 'min' ? 'scale-125 ring-2 ring-blue-300' : 'hover:scale-110'
          } ${isActive ? 'bg-blue-500 border-blue-600' : 'bg-white border-gray-400'}`}
          style={{ left: `${minPercent}%` }}
          onMouseDown={handleMouseDown('min')}
          onKeyDown={handleKeyDown('min')}
          onFocus={() => setFocusedHandle('min')}
          onBlur={() => setFocusedHandle(null)}
          title="Start year (use arrow keys to adjust)"
        />

        {/* Max handle */}
        <div
          role="slider"
          aria-label="End year"
          aria-valuemin={value.min + 1}
          aria-valuemax={max}
          aria-valuenow={value.max}
          aria-valuetext={`${value.max}`}
          tabIndex={0}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 ${SLIDER_HANDLE_SIZE} rounded-full border-2 cursor-ew-resize transition-all z-10 ${
            dragging === 'max' || focusedHandle === 'max' ? 'scale-125 ring-2 ring-blue-300' : 'hover:scale-110'
          } ${isActive ? 'bg-blue-500 border-blue-600' : 'bg-white border-gray-400'}`}
          style={{ left: `${maxPercent}%` }}
          onMouseDown={handleMouseDown('max')}
          onKeyDown={handleKeyDown('max')}
          onFocus={() => setFocusedHandle('max')}
          onBlur={() => setFocusedHandle(null)}
          title="End year (use arrow keys to adjust)"
        />
      </div>
      <span className={`text-[10px] font-medium tabular-nums ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
        {value.max}
      </span>
    </div>
  );
}

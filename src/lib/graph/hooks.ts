'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ArtistGraph, ArtistNode, ArtistRelationship } from '@/types';
import type { ExpansionDepth } from './types';
import { buildGraphData, mergeGraphData } from './builder';
import { getArtistRelationships } from '@/lib/musicbrainz/client';

interface RelationshipsData {
  artist: ArtistNode;
  relationships: ArtistRelationship[];
  relatedArtists: ArtistNode[];
}

export interface UseGraphExpansionResult {
  graphData: ArtistGraph;
  isExpanding: boolean;
  expandProgress: { current: number; total: number } | null;
  expansionDepth: ExpansionDepth;
  availableRelTypes: string[];
  handleDepthChange: (depth: ExpansionDepth) => void;
  handleNodeExpand: (nodeId: string) => Promise<void>;
  handleResetGraph: () => void;
  hasExpandedGraph: boolean;
}

export function useGraphExpansion(
  artistId: string,
  initialData: RelationshipsData | undefined
): UseGraphExpansionResult {
  const [expandedGraph, setExpandedGraph] = useState<ArtistGraph | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [autoExpandComplete, setAutoExpandComplete] = useState(false);
  const [expansionDepth, setExpansionDepth] = useState<ExpansionDepth>(1);
  const [expandProgress, setExpandProgress] = useState<{ current: number; total: number } | null>(null);

  // Build initial graph data from relationships
  const initialGraphData = useMemo<ArtistGraph>(() => {
    if (!initialData) return { nodes: [], edges: [] };
    return buildGraphData(
      initialData.artist,
      initialData.relationships,
      initialData.relatedArtists,
      initialData.artist.activeYears?.begin
    );
  }, [initialData]);

  // Use expanded graph if available, otherwise initial
  const graphData = expandedGraph || initialGraphData;

  // Compute available relationship types from current graph edges
  const availableRelTypes = useMemo(() => {
    const types = new Set<string>();
    graphData.edges.forEach(edge => {
      if (edge.data.type) {
        types.add(edge.data.type);
      }
    });
    return Array.from(types);
  }, [graphData.edges]);

  // Multi-level expansion function
  const performMultiLevelExpansion = useCallback(async (depth: ExpansionDepth) => {
    if (!initialData || isExpanding) return;

    setIsExpanding(true);
    setAutoExpandComplete(true);

    let currentGraph = buildGraphData(
      initialData.artist,
      initialData.relationships,
      initialData.relatedArtists,
      initialData.artist.activeYears?.begin
    );

    if (depth === 1) {
      setExpandedGraph(currentGraph);
      setIsExpanding(false);
      return;
    }

    const nodeDepths = new Map<string, number>();
    nodeDepths.set(initialData.artist.id, 0);
    for (const node of currentGraph.nodes) {
      if (!nodeDepths.has(node.data.id)) {
        nodeDepths.set(node.data.id, 1);
      }
    }

    for (let currentLevel = 1; currentLevel < depth; currentLevel++) {
      const nodesToExpand = currentGraph.nodes
        .filter(n =>
          n.data.loaded === false &&
          nodeDepths.get(n.data.id) === currentLevel
        )
        .map(n => n.data);

      if (nodesToExpand.length === 0) break;

      setExpandProgress({ current: 0, total: nodesToExpand.length });

      for (let i = 0; i < nodesToExpand.length; i++) {
        const nodeToExpand = nodesToExpand[i];
        setExpandProgress({ current: i + 1, total: nodesToExpand.length });

        try {
          const expandedData = await getArtistRelationships(nodeToExpand.id);

          if (expandedData) {
            const newGraph = buildGraphData(
              expandedData.artist,
              expandedData.relationships,
              expandedData.relatedArtists,
              expandedData.artist.activeYears?.begin
            );

            for (const node of newGraph.nodes) {
              if (!nodeDepths.has(node.data.id)) {
                nodeDepths.set(node.data.id, currentLevel + 1);
              }
            }

            currentGraph = mergeGraphData(
              currentGraph,
              newGraph.nodes,
              newGraph.edges,
              nodeToExpand.id
            );
          }
        } catch (err) {
          console.error(`Failed to expand ${nodeToExpand.name}:`, err);
        }
      }
    }

    setExpandedGraph(currentGraph);
    setIsExpanding(false);
    setExpandProgress(null);
  }, [initialData, isExpanding]);

  // Auto-expand when data loads
  useEffect(() => {
    if (!initialData || autoExpandComplete || isExpanding) return;
    performMultiLevelExpansion(expansionDepth);
  }, [initialData, autoExpandComplete, isExpanding, expansionDepth, performMultiLevelExpansion]);

  // Handle expansion depth change
  const handleDepthChange = useCallback((newDepth: ExpansionDepth) => {
    if (newDepth === expansionDepth || isExpanding) return;
    setExpansionDepth(newDepth);
    setAutoExpandComplete(false);
    setExpandedGraph(null);
  }, [expansionDepth, isExpanding]);

  // Handle node expansion
  const handleNodeExpand = useCallback(async (nodeId: string) => {
    if (isExpanding) return;

    setIsExpanding(true);

    try {
      const expandedData = await getArtistRelationships(nodeId);

      if (expandedData) {
        const newGraph = buildGraphData(
          expandedData.artist,
          expandedData.relationships,
          expandedData.relatedArtists,
          expandedData.artist.activeYears?.begin
        );

        const currentGraph = expandedGraph || initialGraphData;
        const merged = mergeGraphData(
          currentGraph,
          newGraph.nodes,
          newGraph.edges,
          nodeId
        );

        setExpandedGraph(merged);
      }
    } catch (err) {
      console.error('Failed to expand node:', err);
    } finally {
      setIsExpanding(false);
    }
  }, [isExpanding, expandedGraph, initialGraphData]);

  // Reset graph
  const handleResetGraph = useCallback(() => {
    setExpandedGraph(null);
    setAutoExpandComplete(false);
  }, []);

  return {
    graphData,
    isExpanding,
    expandProgress,
    expansionDepth,
    availableRelTypes,
    handleDepthChange,
    handleNodeExpand,
    handleResetGraph,
    hasExpandedGraph: expandedGraph !== null,
  };
}

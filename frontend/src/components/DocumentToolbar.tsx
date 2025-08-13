'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, RefreshCw, Upload, Plus } from 'lucide-react';

interface DocumentToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onFilterClick?: () => void;
  onRefreshClick?: () => void;
  onAddDocumentClick: () => void;
  isRefreshing?: boolean;
  isUploading?: boolean;
  className?: string;
}

export default function DocumentToolbar({
  searchValue,
  onSearchChange,
  onFilterClick,
  onRefreshClick,
  onAddDocumentClick,
  isRefreshing = false,
  isUploading = false,
  className = ""
}: DocumentToolbarProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 shadow-sm ${className}`}>
      <div className="flex items-center gap-3">
        {/* Search Bar */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Rechercher un document..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Filters */}
          {onFilterClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onFilterClick}
              className="h-10"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </Button>
          )}

          {/* Refresh */}
          {onRefreshClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefreshClick}
              disabled={isRefreshing}
              className="h-10 px-3"
              title="Actualiser"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}

          {/* Add Document */}
          <Button
            onClick={onAddDocumentClick}
            disabled={isUploading}
            className="h-10"
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Upload...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter document
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
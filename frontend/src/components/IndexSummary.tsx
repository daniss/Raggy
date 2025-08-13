'use client';

import React from 'react';
import { Activity, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface IndexSummaryProps {
  docsReady: number;
  totalDocs: number;
  lastUpdate: string | null;
  assistantOk: boolean;
  processingCount: number;
  totalSizeMB: number;
}

export default function IndexSummary({
  docsReady,
  totalDocs,
  lastUpdate,
  assistantOk,
  processingCount,
  totalSizeMB
}: IndexSummaryProps) {
  const hasData = totalDocs > 0;
  
  if (!hasData) {
    return null; // Don't show when no data
  }

  const formatLastUpdate = (timestamp: string | null) => {
    if (!timestamp) return 'jamais';
    try {
      return new Date(timestamp).toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return 'récemment';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface"
      style={{ 
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-bg-alt)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-gray-900">Vue d'ensemble:</span>
        </div>
        
        <div className="flex items-center text-sm spacing-16">
          {/* Documents Status */}
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-900">
              {docsReady} document{docsReady > 1 ? 's' : ''}
            </span>
            <span className="text-gray-500">prêt{docsReady > 1 ? 's' : ''}</span>
          </div>

          <div className="w-1 h-1 bg-gray-300 rounded-full"></div>

          {/* Processing Status */}
          {processingCount > 0 && (
            <>
              <div className="flex items-center gap-1 text-yellow-600">
                <Clock className="w-3 h-3" />
                <span className="font-medium">{processingCount} en traitement</span>
              </div>
              <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
            </>
          )}

          {/* Size */}
          <div className="flex items-center gap-1 text-gray-600">
            <span>{totalSizeMB.toFixed(1)} MB</span>
          </div>

          <div className="w-1 h-1 bg-gray-300 rounded-full"></div>

          {/* Last Update */}
          <div className="flex items-center gap-1 text-gray-600">
            <span>maj {formatLastUpdate(lastUpdate)}</span>
          </div>

          <div className="w-1 h-1 bg-gray-300 rounded-full"></div>

          {/* Assistant Status */}
          <div className="flex items-center gap-1">
            {assistantOk ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-green-700 font-medium">Assistant prêt</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span className="text-orange-700">En attente</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
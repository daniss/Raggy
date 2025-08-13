'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity, LucideIcon } from 'lucide-react';

export interface MetricsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon: LucideIcon;
  color?: string;
  description?: string;
  loading?: boolean;
  trend?: 'up' | 'down' | 'stable';
  className?: string;
  onClick?: () => void;
}

export function MetricsCard({
  title,
  value,
  change,
  icon: Icon,
  color = 'text-blue-600 bg-blue-50',
  description,
  loading = false,
  trend,
  className = '',
  onClick
}: MetricsCardProps) {
  if (loading) {
    return (
      <Card className={`hover:shadow-lg transition-shadow animate-pulse ${className}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = () => {
    if (change) {
      switch (change.type) {
        case 'increase':
          return <TrendingUp className="w-4 h-4 text-green-600" />;
        case 'decrease':
          return <TrendingDown className="w-4 h-4 text-red-600" />;
        case 'neutral':
          return <Activity className="w-4 h-4 text-gray-600" />;
      }
    }
    
    if (trend) {
      switch (trend) {
        case 'up':
          return <TrendingUp className="w-4 h-4 text-green-600" />;
        case 'down':
          return <TrendingDown className="w-4 h-4 text-red-600" />;
        case 'stable':
          return <Activity className="w-4 h-4 text-gray-600" />;
      }
    }
    
    return null;
  };

  const getChangeColor = () => {
    if (!change) return '';
    
    switch (change.type) {
      case 'increase':
        return 'text-green-600 bg-green-50';
      case 'decrease':
        return 'text-red-600 bg-red-50';
      case 'neutral':
        return 'text-gray-600 bg-gray-50';
      default:
        return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={onClick ? { scale: 1.02 } : {}}
    >
      <Card 
        className={`hover:shadow-lg transition-all duration-200 ${
          onClick ? 'cursor-pointer hover:border-primary' : ''
        } ${className}`}
        onClick={onClick}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-lg ${color}`}>
              <Icon className="w-6 h-6" />
            </div>
            {getTrendIcon()}
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            
            <div className="flex items-center justify-between">
              {change && (
                <Badge variant="secondary" className={`text-xs ${getChangeColor()}`}>
                  {change.value}
                </Badge>
              )}
              
              {description && (
                <p className="text-xs text-gray-500 mt-1">{description}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Specialized metrics cards for common use cases
export interface KPICardProps extends Omit<MetricsCardProps, 'icon'> {
  kpiType: 'queries' | 'users' | 'satisfaction' | 'response_time' | 'cost' | 'documents';
}

export function KPICard({ kpiType, ...props }: KPICardProps) {
  const kpiConfigs = {
    queries: {
      icon: Activity,
      color: 'text-blue-600 bg-blue-50'
    },
    users: {
      icon: TrendingUp,
      color: 'text-green-600 bg-green-50'
    },
    satisfaction: {
      icon: TrendingUp,
      color: 'text-purple-600 bg-purple-50'
    },
    response_time: {
      icon: Activity,
      color: 'text-orange-600 bg-orange-50'
    },
    cost: {
      icon: TrendingDown,
      color: 'text-teal-600 bg-teal-50'
    },
    documents: {
      icon: TrendingUp,
      color: 'text-indigo-600 bg-indigo-50'
    }
  };

  const config = kpiConfigs[kpiType];

  return (
    <MetricsCard
      {...props}
      icon={config.icon}
      color={config.color}
    />
  );
}

// Grid layout for metrics cards
export interface MetricsGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 6;
  className?: string;
}

export function MetricsGrid({ 
  children, 
  columns = 4, 
  className = '' 
}: MetricsGridProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
  };

  return (
    <div className={`grid ${gridClasses[columns]} gap-6 ${className}`}>
      {children}
    </div>
  );
}
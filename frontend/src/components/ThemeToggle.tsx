'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  variant?: 'button' | 'minimal' | 'dropdown';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export default function ThemeToggle({ 
  variant = 'dropdown', 
  size = 'md',
  showLabel = false,
  className 
}: ThemeToggleProps) {
  const { theme, effectiveTheme, setTheme, toggleTheme } = useTheme();

  const themeOptions = [
    {
      value: 'light' as const,
      icon: Sun,
      label: 'Clair',
      description: 'Mode jour avec thème lumineux'
    },
    {
      value: 'dark' as const,
      icon: Moon,
      label: 'Sombre',
      description: 'Mode nuit avec thème sombre'
    },
    {
      value: 'auto' as const,
      icon: Monitor,
      label: 'Automatique',
      description: 'Suit les préférences du système'
    }
  ];

  const currentOption = themeOptions.find(option => option.value === theme) || themeOptions[0];
  const CurrentIcon = currentOption.icon;

  const getIconSize = () => {
    switch (size) {
      case 'sm': return 'w-3 h-3';
      case 'lg': return 'w-5 h-5';
      default: return 'w-4 h-4';
    }
  };

  const getButtonSize = () => {
    switch (size) {
      case 'sm': return 'h-7 px-2';
      case 'lg': return 'h-10 px-4';
      default: return 'h-8 px-3';
    }
  };

  if (variant === 'minimal') {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          "hover:bg-white/10 hover:backdrop-blur-md",
          effectiveTheme === 'dark' ? 'text-yellow-400' : 'text-gray-600',
          getButtonSize(),
          className
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={theme}
            initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2"
          >
            <CurrentIcon className={getIconSize()} />
            {showLabel && (
              <span className="text-sm font-medium">
                {currentOption.label}
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </Button>
    );
  }

  if (variant === 'button') {
    return (
      <Button
        variant="outline"
        onClick={toggleTheme}
        className={cn(
          "relative group transition-all duration-300",
          "bg-white/20 backdrop-blur-md border-white/30",
          "hover:bg-white/30 hover:border-white/50",
          "dark:bg-gray-800/20 dark:border-gray-700/30",
          "dark:hover:bg-gray-800/30 dark:hover:border-gray-600/50",
          getButtonSize(),
          className
        )}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={theme}
                initial={{ scale: 0.5, opacity: 0, rotate: -180 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: 180 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <CurrentIcon className={cn(
                  getIconSize(),
                  effectiveTheme === 'dark' ? 'text-yellow-400' : 'text-gray-700'
                )} />
              </motion.div>
            </AnimatePresence>
          </div>
          {showLabel && (
            <span className="text-sm font-medium">
              {currentOption.label}
            </span>
          )}
        </div>
      </Button>
    );
  }

  // Dropdown variant (default)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "relative group transition-all duration-300",
            "bg-white/10 backdrop-blur-md border border-white/20",
            "hover:bg-white/20 hover:border-white/30",
            "dark:bg-gray-800/10 dark:border-gray-700/20",
            "dark:hover:bg-gray-800/20 dark:hover:border-gray-600/30",
            getButtonSize(),
            className
          )}
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={theme}
                  initial={{ scale: 0.8, opacity: 0, y: -10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.8, opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center"
                >
                  <CurrentIcon className={cn(
                    getIconSize(),
                    effectiveTheme === 'dark' 
                      ? 'text-yellow-400' 
                      : 'text-gray-700',
                    'group-hover:scale-110 transition-transform'
                  )} />
                </motion.div>
              </AnimatePresence>
            </div>
            {showLabel && (
              <span className="text-sm font-medium">
                {currentOption.label}
              </span>
            )}
            <Badge 
              variant="secondary" 
              className="text-xs bg-white/20 text-gray-700 dark:text-gray-300"
            >
              {effectiveTheme === 'dark' ? '🌙' : '☀️'}
            </Badge>
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className={cn(
          "w-56 bg-white/80 backdrop-blur-xl border-white/30",
          "dark:bg-gray-900/80 dark:border-gray-700/30",
          "shadow-xl"
        )}
      >
        <div className="p-2">
          <div className="flex items-center gap-2 mb-2 px-2 py-1">
            <Palette className="w-4 h-4 text-purple-600" />
            <span className="font-medium text-sm">Thème d'affichage</span>
          </div>
          
          {themeOptions.map((option) => {
            const OptionIcon = option.icon;
            const isSelected = theme === option.value;
            
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "relative flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer",
                  "transition-all duration-200",
                  isSelected 
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" 
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isSelected 
                    ? "bg-purple-200 dark:bg-purple-800" 
                    : "bg-gray-100 dark:bg-gray-700"
                )}>
                  <OptionIcon className={cn(
                    "w-4 h-4",
                    isSelected 
                      ? "text-purple-600 dark:text-purple-400" 
                      : "text-gray-600 dark:text-gray-400"
                  )} />
                </div>
                
                <div className="flex-1">
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {option.description}
                  </div>
                </div>
                
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-2 h-2 bg-purple-600 rounded-full"
                  />
                )}
              </DropdownMenuItem>
            );
          })}
        </div>
        
        <DropdownMenuSeparator className="bg-gray-200/50 dark:bg-gray-700/50" />
        
        <div className="p-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center justify-between">
            <span>Thème actuel :</span>
            <Badge variant="outline" className="text-xs">
              {effectiveTheme === 'dark' ? 'Sombre' : 'Clair'}
            </Badge>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
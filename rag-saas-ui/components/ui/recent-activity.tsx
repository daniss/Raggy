"use client"

import type React from "react"
import { FileText, MessageSquare, BarChart3, Settings, Clock } from "lucide-react"
import { useActivity } from "@/lib/hooks/use-activity"
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/utils/time"

export interface RecentActivityProps {
  limit?: number
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case "document":
      return <FileText className="w-4 h-4 text-blue-500" />
    case "question":
      return <MessageSquare className="w-4 h-4 text-green-500" />
    case "analysis":
      return <BarChart3 className="w-4 h-4 text-purple-500" />
    case "system":
      return <Settings className="w-4 h-4 text-gray-500" />
    default:
      return <Clock className="w-4 h-4 text-gray-400" />
  }
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ limit = 5 }) => {
  const { activities, loading } = useActivity(limit)

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Aucune activité récente</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3 group">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-200 transition-colors">
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 truncate">{activity.label}</p>
            <p
              className="text-xs text-gray-500"
              title={formatAbsoluteTime(activity.time)}
            >
              {formatRelativeTime(activity.time)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
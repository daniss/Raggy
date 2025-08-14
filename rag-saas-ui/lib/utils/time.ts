export function formatRelativeTime(dateString: string | Date): string {
  const now = new Date()
  const date = typeof dateString === "string" ? new Date(dateString) : dateString
  const diffInMs = now.getTime() - date.getTime()

  const seconds = Math.floor(diffInMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) {
    return "À l'instant"
  } else if (minutes < 60) {
    return `Il y a ${minutes} min`
  } else if (hours < 24) {
    return `Il y a ${hours}h`
  } else if (days < 7) {
    return days === 1 ? "Hier" : `Il y a ${days} jours`
  } else {
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    })
  }
}

export function formatAbsoluteTime(dateString: string | Date): string {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatTimeOnly(dateString: string | Date): string {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Alias pour compatibilité
export const formatTimeAgo = formatRelativeTime
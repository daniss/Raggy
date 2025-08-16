export default function AssistantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ backgroundColor: '#F7F9FB', minHeight: '100vh' }}>
      {children}
    </div>
  )
}

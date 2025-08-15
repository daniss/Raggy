'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Activity, Clock, Shield, Zap } from 'lucide-react'

interface QAMetrics {
  timestamp: string
  service_status: string
  performance_metrics: Record<string, number>
  quality_scores: Record<string, number>
  system_health: Record<string, any>
}

interface QAReport {
  status: string
  message: string
  metrics?: QAMetrics
  error?: string
}

export function QADashboard() {
  const [qaMetrics, setQaMetrics] = useState<QAReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [testQuery, setTestQuery] = useState('What is the purpose of this RAG system?')
  const [validationResult, setValidationResult] = useState<any>(null)
  const [validationLoading, setValidationLoading] = useState(false)

  const fetchQAMetrics = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/rag/qa')
      const data = await response.json()
      setQaMetrics(data)
    } catch (error) {
      console.error('Failed to fetch QA metrics:', error)
      setQaMetrics({
        status: 'error',
        message: 'Failed to fetch QA metrics',
        error: 'Network error'
      })
    } finally {
      setLoading(false)
    }
  }

  const runQualityValidation = async () => {
    if (!testQuery.trim()) return

    setValidationLoading(true)
    try {
      const response = await fetch('/api/rag/qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: testQuery,
          orgId: 'qa-test-org'
        })
      })
      
      const data = await response.json()
      setValidationResult(data)
    } catch (error) {
      console.error('Quality validation failed:', error)
      setValidationResult({
        status: 'error',
        message: 'Quality validation failed',
        error: 'Network error'
      })
    } finally {
      setValidationLoading(false)
    }
  }

  useEffect(() => {
    fetchQAMetrics()
    
    // Auto-refresh metrics every 30 seconds
    const interval = setInterval(fetchQAMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'operational':
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'unavailable':
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'operational':
      case 'healthy':
        return 'bg-green-100 text-green-800'
      case 'unavailable':
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const getQualityGrade = (score: number) => {
    if (score >= 0.9) return { grade: 'A', color: 'text-green-600' }
    if (score >= 0.8) return { grade: 'B', color: 'text-blue-600' }
    if (score >= 0.7) return { grade: 'C', color: 'text-yellow-600' }
    return { grade: 'D', color: 'text-red-600' }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">RAG Quality Assurance</h2>
          <p className="text-muted-foreground">
            Monitor and validate RAG system quality, performance, and reliability
          </p>
        </div>
        <Button
          onClick={fetchQAMetrics}
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </Button>
      </div>

      {/* System Status Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getStatusIcon(qaMetrics?.status || 'unknown')}
              <Badge className={getStatusColor(qaMetrics?.status || 'unknown')}>
                {qaMetrics?.status || 'Unknown'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {qaMetrics?.metrics?.performance_metrics?.total_response_time_ms 
                ? formatLatency(qaMetrics.metrics.performance_metrics.total_response_time_ms)
                : 'N/A'
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {qaMetrics?.metrics?.quality_scores?.overall_health !== undefined 
                ? `${(qaMetrics.metrics.quality_scores.overall_health * 100).toFixed(0)}%`
                : 'N/A'
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Grade</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {qaMetrics?.metrics?.quality_scores?.overall_health !== undefined ? (
              <div className={`text-2xl font-bold ${getQualityGrade(qaMetrics.metrics.quality_scores.overall_health).color}`}>
                {getQualityGrade(qaMetrics.metrics.quality_scores.overall_health).grade}
              </div>
            ) : (
              <div className="text-2xl font-bold text-gray-500">N/A</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      {qaMetrics?.metrics && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                Real-time performance measurements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(qaMetrics.metrics.performance_metrics).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-mono">
                    {typeof value === 'number' && key.includes('ms') 
                      ? formatLatency(value)
                      : String(value)
                    }
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quality Scores</CardTitle>
              <CardDescription>
                Quality assessment indicators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(qaMetrics.metrics.quality_scores).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-mono">
                      {typeof value === 'number' ? `${(value * 100).toFixed(0)}%` : String(value)}
                    </span>
                  </div>
                  {typeof value === 'number' && (
                    <Progress value={value * 100} className="h-2" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quality Validation */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Validation</CardTitle>
          <CardDescription>
            Test RAG quality with custom queries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="test-query" className="text-sm font-medium">
              Test Query
            </label>
            <Textarea
              id="test-query"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Enter a test query to validate RAG quality..."
              rows={3}
            />
          </div>
          
          <Button
            onClick={runQualityValidation}
            disabled={validationLoading || !testQuery.trim()}
            className="w-full"
          >
            {validationLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Running Quality Validation...
              </>
            ) : (
              'Run Quality Validation'
            )}
          </Button>

          {validationResult && (
            <Alert className={validationResult.status === 'error' ? 'border-red-200' : 'border-green-200'}>
              <AlertTitle className="flex items-center">
                {getStatusIcon(validationResult.status)}
                <span className="ml-2">Validation Result</span>
              </AlertTitle>
              <AlertDescription className="mt-2">
                <div className="space-y-2">
                  <p>{validationResult.message}</p>
                  {validationResult.validation_result && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-md">
                      <pre className="text-xs whitespace-pre-wrap">
                        {JSON.stringify(validationResult.validation_result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* System Alerts */}
      {qaMetrics?.error && (
        <Alert className="border-red-200">
          <XCircle className="h-4 w-4" />
          <AlertTitle>System Alert</AlertTitle>
          <AlertDescription>
            {qaMetrics.message}: {qaMetrics.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
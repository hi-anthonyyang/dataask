import React from 'react'
import { VariableProperties } from '../types'

interface VariablePropertiesPanelProps {
  variable: VariableProperties
  compact?: boolean
}

interface ExtendedStats {
  count: number
  missing_count: number
  completeness: number
  uniqueness_ratio?: number
  outlier_count?: number
  distribution_type?: string
  quality_score?: number
  outlier_method?: string
  mean?: number
  median?: number
  mode?: string | number
  std_dev?: number
  variance?: number
  range?: { min: number; max: number }
  quartiles?: { q1: number; q2: number; q3: number }
  skewness?: number
  kurtosis?: number
}

const formatNumber = (num: number, decimals: number = 2): string => {
  if (Math.abs(num) >= 1000000) {
    return `${(num / 1000000).toFixed(decimals)}M`
  }
  if (Math.abs(num) >= 1000) {
    return `${(num / 1000).toFixed(decimals)}K`
  }
  return num.toFixed(decimals)
}

const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`
}

const getQualityColor = (score: number): string => {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

const getQualityBgColor = (score: number): string => {
  if (score >= 80) return 'bg-green-50 border-green-200'
  if (score >= 60) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

export default function VariablePropertiesPanel({ variable, compact = false }: VariablePropertiesPanelProps) {
  const stats = variable.statistics as ExtendedStats
  const domainInfo = variable.domain_info

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{variable.name}</span>
          <span className={`px-2 py-1 text-xs rounded ${
            variable.measurement_level === 'ratio' ? 'bg-blue-100 text-blue-800' :
            variable.measurement_level === 'interval' ? 'bg-green-100 text-green-800' :
            variable.measurement_level === 'ordinal' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {variable.measurement_level || 'unknown'}
          </span>
        </div>

        {stats && (
          <div className="space-y-1 text-xs">
            {/* Basic Info Row */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">Sample Size:</span>
                <span className="ml-1 font-medium">{stats.count.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500">Missing:</span>
                <span className="ml-1 font-medium">{formatPercentage(1 - stats.completeness)}</span>
              </div>
            </div>

            {/* Unique Values & Distribution Row */}
            <div className="grid grid-cols-2 gap-2">
              {stats.uniqueness_ratio !== undefined && (
                <div>
                  <span className="text-gray-500">Unique:</span>
                  <span className="ml-1 font-medium">{Math.round(stats.uniqueness_ratio * stats.count).toLocaleString()}</span>
                </div>
              )}
              {stats.distribution_type && (
                <div>
                  <span className="text-gray-500">Distribution:</span>
                  <span className={`ml-1 font-medium ${
                    stats.distribution_type === 'normal' ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {stats.distribution_type}
                  </span>
                </div>
              )}
            </div>

            {/* Outliers & Numeric Stats Row */}
            <div className="grid grid-cols-2 gap-2">
              {stats.outlier_count !== undefined && (
                <div>
                  <span className="text-gray-500">Outliers:</span>
                  <span className={`ml-1 font-medium ${
                    stats.outlier_count > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {stats.outlier_count > 0 ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
              {stats.mean !== undefined && (
                <div>
                  <span className="text-gray-500">Mean:</span>
                  <span className="ml-1 font-medium">{formatNumber(stats.mean)}</span>
                </div>
              )}
            </div>

            {/* Standard Deviation if available */}
            {stats.std_dev !== undefined && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-500">Std Dev:</span>
                  <span className="ml-1 font-medium">{formatNumber(stats.std_dev)}</span>
                </div>
                <div></div> {/* Empty cell for alignment */}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{variable.name}</h3>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs rounded ${
            variable.measurement_level === 'ratio' ? 'bg-blue-100 text-blue-800' :
            variable.measurement_level === 'interval' ? 'bg-green-100 text-green-800' :
            variable.measurement_level === 'ordinal' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {variable.measurement_level || 'unknown'} level
          </span>
          {stats.quality_score && (
            <span className={`px-2 py-1 text-xs rounded ${getQualityBgColor(stats.quality_score)}`}>
              Quality: {stats.quality_score}/100
            </span>
          )}
        </div>
      </div>

      {/* Basic Statistics */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Data Quality</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Count:</span>
                <span className="font-medium">{stats.count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Missing:</span>
                <span className="font-medium">{stats.missing_count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completeness:</span>
                <span className={`font-medium ${getQualityColor(stats.completeness * 100)}`}>
                  {formatPercentage(stats.completeness)}
                </span>
              </div>
              {stats.uniqueness_ratio !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Unique Values:</span>
                  <span className="font-medium">{formatPercentage(stats.uniqueness_ratio)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Central Tendency */}
          {(stats.mean !== undefined || stats.median !== undefined) && (
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Central Tendency</h4>
              <div className="space-y-1 text-sm">
                {stats.mean !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mean:</span>
                    <span className="font-medium">{formatNumber(stats.mean)}</span>
                  </div>
                )}
                {stats.median !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Median:</span>
                    <span className="font-medium">{formatNumber(stats.median)}</span>
                  </div>
                )}
                {stats.mode !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mode:</span>
                    <span className="font-medium">{typeof stats.mode === 'number' ? formatNumber(stats.mode) : String(stats.mode)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dispersion Statistics */}
      {stats && (stats.std_dev !== undefined || stats.range) && (
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Dispersion</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {stats.std_dev !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Standard Deviation:</span>
                <span className="font-medium">{formatNumber(stats.std_dev)}</span>
              </div>
            )}
            {stats.variance !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Variance:</span>
                <span className="font-medium">{formatNumber(stats.variance)}</span>
              </div>
            )}
            {stats.range && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600">Min:</span>
                  <span className="font-medium">{formatNumber(stats.range.min)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Max:</span>
                  <span className="font-medium">{formatNumber(stats.range.max)}</span>
                </div>
              </>
            )}
            {stats.outlier_count !== undefined && (
              <div className="flex justify-between col-span-2">
                <span className="text-gray-600">Outliers Detected:</span>
                <span className="font-medium">{stats.outlier_count} ({stats.outlier_method})</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Distribution Analysis */}
      {stats && (stats.skewness !== undefined || stats.distribution_type) && (
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Distribution Shape</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {stats.skewness !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Skewness:</span>
                <span className={`font-medium ${Math.abs(stats.skewness) < 0.5 ? 'text-green-600' : Math.abs(stats.skewness) < 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {formatNumber(stats.skewness)}
                </span>
              </div>
            )}
            {stats.kurtosis !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Kurtosis:</span>
                <span className={`font-medium ${Math.abs(stats.kurtosis) < 0.5 ? 'text-green-600' : Math.abs(stats.kurtosis) < 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {formatNumber(stats.kurtosis)}
                </span>
              </div>
            )}
            {stats.distribution_type && (
              <div className="flex justify-between col-span-2">
                <span className="text-gray-600">Distribution Type:</span>
                <span className="font-medium capitalize">{stats.distribution_type.replace('_', ' ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Domain Information */}
      {domainInfo && (
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Domain Information</h4>
          <div className="space-y-2 text-sm">
            {domainInfo.business_meaning && (
              <div>
                <span className="text-gray-600">Business Meaning:</span>
                <p className="font-medium mt-1">{domainInfo.business_meaning}</p>
              </div>
            )}
            {domainInfo.unit_of_measure && (
              <div className="flex justify-between">
                <span className="text-gray-600">Unit:</span>
                <span className="font-medium">{domainInfo.unit_of_measure}</span>
              </div>
            )}
            {domainInfo.expected_range && (
              <div className="flex justify-between">
                <span className="text-gray-600">Expected Range:</span>
                <span className="font-medium">
                  {domainInfo.expected_range.min !== undefined ? formatNumber(domainInfo.expected_range.min) : '-∞'} to
                  {domainInfo.expected_range.max !== undefined ? formatNumber(domainInfo.expected_range.max) : '∞'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {variable.recommendations && (
        <div className="bg-blue-50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Recommendations</h4>
          <div className="space-y-2 text-sm text-blue-800">
            {variable.recommendations.suggested_transformations && variable.recommendations.suggested_transformations.length > 0 && (
              <div>
                <span className="font-medium">Suggested Transformations:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {variable.recommendations.suggested_transformations.map(transform => (
                    <span key={transform} className="px-2 py-1 bg-blue-100 rounded text-xs">
                      {transform.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {variable.recommendations.statistical_tests && variable.recommendations.statistical_tests.length > 0 && (
              <div>
                <span className="font-medium">Recommended Tests:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {variable.recommendations.statistical_tests.map(test => (
                    <span key={test} className="px-2 py-1 bg-blue-100 rounded text-xs">
                      {test.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

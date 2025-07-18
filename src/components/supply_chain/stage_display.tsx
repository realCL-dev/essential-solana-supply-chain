import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExplorerLink } from '../cluster/cluster-ui'
import { ellipsify } from '@wallet-ui/react'
import { useState } from 'react'
import type { Account, Address } from 'gill'
import { EventType, Product } from '@project/anchor'
import { useLogEventMutation } from './supply_chain-data-access'


type ProductAccount = Account<Product, string>

export function StageDisplay({ 
  product, 
  userAddress,
  onStageCompleted 
}: { 
  product: ProductAccount
  userAddress?: string
  onStageCompleted?: () => void
}) {
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const completeStageMutation = useLogEventMutation()

  if (!product.data.stages.length) {
    return null
  }

  const currentStageIndex = product.data.currentStageIndex
  const currentStage = product.data.stages[currentStageIndex]
  const nextStage = product.data.stages[currentStageIndex + 1]
  const isOwner = userAddress === product.data.owner
  const allStagesCompleted = currentStageIndex >= product.data.stages.length

  const handleCompleteStage = async () => {
    try {
      await completeStageMutation.mutateAsync({ 
        productAddress: product.address as Address,
        eventType: EventType.Complete,
        description: `Stage completed: ${currentStage.name}`
      })
      setShowCompleteConfirm(false)
      onStageCompleted?.()
    } catch (error) {
      console.error('Error completing stage:', error)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Stage Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stage Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Progress</span>
            <span>
              {Math.min(currentStageIndex + 1, product.data.stages.length)} / {product.data.stages.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${(Math.min(currentStageIndex + 1, product.data.stages.length) / product.data.stages.length) * 100}%` 
              }}
            />
          </div>
        </div>

        {/* Current Stage */}
        {!allStagesCompleted && currentStage && (
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-sm">Current Stage</h4>
              <div className="mt-1 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-blue-900">{currentStage.name}</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                    In Progress
                  </span>
                </div>
                {currentStage.owner && currentStage.owner.__option === 'Some' && (
                  <div className="mt-2 text-xs text-blue-700">
                    <span>Auto-transfer to: </span>
                    <ExplorerLink 
                      address={currentStage.owner.value} 
                      label={ellipsify(currentStage.owner.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Complete Stage Button */}
            {isOwner && !showCompleteConfirm && (
              <Button 
                onClick={() => setShowCompleteConfirm(true)}
                className="w-full"
                size="sm"
              >
                Complete {currentStage.name} Stage
              </Button>
            )}

            {/* Confirmation */}
            {showCompleteConfirm && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">Complete Current Stage?</p>
                  <p className="text-yellow-700 mt-1">
                    This will mark "{currentStage.name}" as completed.
                    {nextStage?.owner && nextStage.owner.__option === 'Some' && (
                      <span className="block mt-1">
                        <strong>Ownership will transfer to:</strong> {ellipsify(nextStage.owner.value)}
                      </span>
                    )}
                    {!nextStage && (
                      <span className="block mt-1">
                        <strong>This is the final stage.</strong> Product will be marked as delivered.
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleCompleteStage}
                    disabled={completeStageMutation.isPending}
                    size="sm"
                    className="flex-1"
                  >
                    {completeStageMutation.isPending ? 'Completing...' : 'Confirm'}
                  </Button>
                  <Button 
                    onClick={() => setShowCompleteConfirm(false)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Next Stage Preview */}
        {!allStagesCompleted && nextStage && (
          <div>
            <h4 className="font-medium text-sm">Next Stage</h4>
            <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">{nextStage.name}</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                  Pending
                </span>
              </div>
              {nextStage.owner && nextStage.owner.__option === 'Some' && (
                <div className="mt-2 text-xs text-gray-600">
                  <span>Will transfer to: </span>
                  <ExplorerLink 
                    address={nextStage.owner.value} 
                    label={ellipsify(nextStage.owner.value)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* All Stages Completed */}
        {allStagesCompleted && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium text-green-900">All Stages Completed</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                Delivered
              </span>
            </div>
            <p className="text-green-700 text-xs mt-1">
              This product has successfully completed all supply chain stages.
            </p>
          </div>
        )}

        {/* Ownership Notice */}
        {!isOwner && currentStage && (
          <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs">
            <p className="text-orange-800">
              <strong>Note:</strong> Only the current owner can complete stages.
            </p>
          </div>
        )}

        {/* All Stages List (Collapsible) */}
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
            View All Stages
          </summary>
          <div className="mt-2 space-y-2">
            {product.data.stages.map((stage, index) => (
              <div 
                key={index}
                className={`p-2 rounded border ${
                  index < currentStageIndex 
                    ? 'bg-green-50 border-green-200' 
                    : index === currentStageIndex
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${
                    index < currentStageIndex 
                      ? 'text-green-900' 
                      : index === currentStageIndex
                      ? 'text-blue-900'
                      : 'text-gray-700'
                  }`}>
                    {index + 1}. {stage.name}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    index < currentStageIndex 
                      ? 'bg-green-100 text-green-800' 
                      : index === currentStageIndex
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {index < currentStageIndex 
                      ? 'Completed' 
                      : index === currentStageIndex
                      ? 'Current'
                      : 'Pending'
                    }
                  </span>
                </div>
                {stage.owner && stage.owner.__option === 'Some' && (
                  <div className="mt-1 text-xs text-gray-600">
                    Transfer to: <ExplorerLink 
                      address={stage.owner.value} 
                      label={ellipsify(stage.owner.value)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
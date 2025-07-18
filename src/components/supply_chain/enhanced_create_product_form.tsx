import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, TextArea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import {
  useCreateProductWithStagesForm,
  useInitializeProductMutation,
  useInitializeProductWithStagesMutation,
  type StageInput,
} from './supply_chain-data-access'
import { ExplorerLink } from '../cluster/cluster-ui'
import { ellipsify } from '@wallet-ui/react'

const INPUT_LIMITS = {
  SERIAL_NUMBER_MAX_LENGTH: 50,
  DESCRIPTION_MAX_LENGTH: 200,
  STAGE_NAME_MAX_LENGTH: 50,
}

export function EnhancedCreateProductForm() {
  const [creationMode, setCreationMode] = useState<'choose' | 'freeform' | 'stages'>('choose')
  const [lastError, setLastError] = useState<Error | null>(null)

  const {
    serialNumber,
    setSerialNumber,
    description,
    setDescription,
    stages,
    addStage,
    updateStage,
    removeStage,
    loadTemplate,
    reset,
    isValid,
  } = useCreateProductWithStagesForm()

  const createProductMutation = useInitializeProductMutation()
  const createProductWithStagesMutation = useInitializeProductWithStagesMutation()

  const handleBackToChoice = () => {
    setCreationMode('choose')
    reset()
    setLastError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    try {
      setLastError(null)

      if (creationMode === 'freeform') {
        await createProductMutation.mutateAsync({ serialNumber, description })
      } else if (creationMode === 'stages') {
        await createProductWithStagesMutation.mutateAsync({
          serialNumber,
          description,
          stages,
        })
      }

      reset()
      setCreationMode('choose')
    } catch (error) {
      setLastError(error instanceof Error ? error : new Error(String(error)))
      console.error('Error creating product:', error)
    }
  }

  if (creationMode === 'choose') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create New Product</CardTitle>
          <CardDescription>Choose how you want to create and track your product</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card
              className="cursor-pointer hover:bg-gray-50 hover:text-accent transition-colors"
              onClick={() => setCreationMode('freeform')}
            >
              <CardHeader>
                <CardTitle className="text-lg">Free Form Tracking</CardTitle>
                <CardDescription>
                  Create a product and manually log events as they happen. You have full control over event types and
                  timing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Use Free Form</Button>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-gray-50 hover:text-accent transition-colors"
              onClick={() => setCreationMode('stages')}
            >
              <CardHeader>
                <CardTitle className="text-lg">Staged Tracking</CardTitle>
                <CardDescription>
                  Define chronological stages with automatic ownership transfer. Perfect for supply chain workflows.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Use Staged Tracking</Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Create New Product - {creationMode === 'freeform' ? 'Free Form' : 'Staged Tracking'}</CardTitle>
            <CardDescription>
              {creationMode === 'freeform'
                ? 'Register a new product for manual event tracking'
                : 'Register a new product with predefined stages and automated ownership transfer'}
            </CardDescription>
          </div>
          <Button onClick={handleBackToChoice} variant="outline" size="sm">
            ← Back to Options
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Product Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Product Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Enter unique product serial number"
                  required
                  maxLength={INPUT_LIMITS.SERIAL_NUMBER_MAX_LENGTH}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <TextArea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter product description"
                  required
                  maxLength={INPUT_LIMITS.DESCRIPTION_MAX_LENGTH}
                />
              </div>
            </div>
          </div>

          {/* Stage Configuration - only for staged mode */}
          {creationMode === 'stages' && (
            <StageConfiguration
              stages={stages}
              onAddStage={addStage}
              onUpdateStage={updateStage}
              onRemoveStage={removeStage}
              onLoadTemplate={loadTemplate}
            />
          )}

          <Button
            type="submit"
            disabled={!isValid || createProductMutation.isPending || createProductWithStagesMutation.isPending}
            className="w-full"
          >
            {createProductMutation.isPending || createProductWithStagesMutation.isPending
              ? 'Creating Product...'
              : `Create ${creationMode === 'freeform' ? 'Free Form' : 'Staged'} Product`}
          </Button>

          {lastError && process.env.NODE_ENV === 'development' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
              <details>
                <summary className="cursor-pointer font-medium text-red-800">
                  Debug Information (Development Only)
                </summary>
                <pre className="mt-2 text-red-700 overflow-auto">{JSON.stringify(lastError, null, 2)}</pre>
              </details>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function StageConfiguration({
  stages,
  onAddStage,
  onUpdateStage,
  onRemoveStage,
  onLoadTemplate,
}: {
  stages: StageInput[]
  onAddStage: () => void
  onUpdateStage: (index: number, field: keyof StageInput, value: string) => void
  onRemoveStage: (index: number) => void
  onLoadTemplate: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Stage Configuration</h3>
        <div className="space-x-2">
          <Button type="button" onClick={onLoadTemplate} variant="outline" size="sm">
            Load Template
          </Button>
          <Button type="button" onClick={onAddStage} variant="outline" size="sm">
            Add Stage
          </Button>
        </div>
      </div>

      {stages.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-600 mb-4">No stages configured yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Add stages manually or use the template for common supply chain stages
          </p>
          <Button onClick={onLoadTemplate} variant="outline">
            Load Default Template
          </Button>
        </div>
      )}

      {stages.map((stage, index) => (
        <Card key={index} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Stage {index + 1}</CardTitle>
              <Button
                type="button"
                onClick={() => onRemoveStage(index)}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-800"
              >
                Remove
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`stage-name-${index}`}>Stage Name</Label>
                <Input
                  id={`stage-name-${index}`}
                  value={stage.name}
                  onChange={(e) => onUpdateStage(index, 'name', e.target.value)}
                  placeholder="e.g., Farm, Warehouse, etc."
                  required
                  maxLength={INPUT_LIMITS.STAGE_NAME_MAX_LENGTH}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`stage-wallet-${index}`}>Wallet Address (Optional)</Label>
                <Input
                  id={`stage-wallet-${index}`}
                  value={stage.wallet || ''}
                  onChange={(e) => onUpdateStage(index, 'wallet', e.target.value)}
                  placeholder="Enter Solana wallet address"
                />
                {stage.wallet && (
                  <p className="text-xs text-gray-600">
                    <ExplorerLink address={stage.wallet} label={ellipsify(stage.wallet)} />
                  </p>
                )}
              </div>
            </div>
            {stage.wallet && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                <p className="text-blue-800">
                  <strong>Auto-transfer:</strong> When this stage is completed, ownership will automatically transfer to
                  the specified wallet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {stages.length > 0 && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium mb-2">Stage Flow Preview:</h4>
          <div className="flex items-center space-x-2 text-sm">
            {stages.map((stage, index) => (
              <div key={index} className="flex items-center">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {stage.name || `Stage ${index + 1}`}
                </span>
                {index < stages.length - 1 && <span className="mx-2 text-gray-400">→</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

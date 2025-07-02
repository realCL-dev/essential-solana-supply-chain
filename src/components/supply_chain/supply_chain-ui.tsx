import { ellipsify } from '@wallet-ui/react'
import {
  useSupplyChainAccountsQuery,
  useSupplyChainCloseMutation,
  useSupplyChainDecrementMutation,
  useSupplyChainIncrementMutation,
  useSupplyChainInitializeMutation,
  useSupplyChainProgram,
  useSupplyChainProgramId,
  useSupplyChainSetMutation,
} from './supply_chain-data-access'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExplorerLink } from '../cluster/cluster-ui'
import { SupplyChainAccount } from '@project/anchor'
import { ReactNode } from 'react'

export function SupplyChainProgramExplorerLink() {
  const programId = useSupplyChainProgramId()

  return <ExplorerLink address={programId.toString()} label={ellipsify(programId.toString())} />
}

export function SupplyChainList() {
  const supply_chainAccountsQuery = useSupplyChainAccountsQuery()

  if (supply_chainAccountsQuery.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }

  if (!supply_chainAccountsQuery.data?.length) {
    return (
      <div className="text-center">
        <h2 className={'text-2xl'}>No accounts</h2>
        No accounts found. Initialize one to get started.
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {supply_chainAccountsQuery.data?.map((supply_chain) => <SupplyChainCard key={supply_chain.address} supply_chain={supply_chain} />)}
    </div>
  )
}

export function SupplyChainProgramGuard({ children }: { children: ReactNode }) {
  const programAccountQuery = useSupplyChainProgram()

  if (programAccountQuery.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }

  if (!programAccountQuery.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>Program account not found. Make sure you have deployed the program and are on the correct cluster.</span>
      </div>
    )
  }

  return children
}

function SupplyChainCard({ supply_chain }: { supply_chain: SupplyChainAccount }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>SupplyChain: {supply_chain.data.count}</CardTitle>
        <CardDescription>
          Account: <ExplorerLink address={supply_chain.address} label={ellipsify(supply_chain.address)} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 justify-evenly">
          <SupplyChainButtonIncrement supply_chain={supply_chain} />
          <SupplyChainButtonSet supply_chain={supply_chain} />
          <SupplyChainButtonDecrement supply_chain={supply_chain} />
          <SupplyChainButtonClose supply_chain={supply_chain} />
        </div>
      </CardContent>
    </Card>
  )
}

export function SupplyChainButtonInitialize() {
  const mutationInitialize = useSupplyChainInitializeMutation()

  return (
    <Button onClick={() => mutationInitialize.mutateAsync()} disabled={mutationInitialize.isPending}>
      Initialize SupplyChain {mutationInitialize.isPending && '...'}
    </Button>
  )
}

export function SupplyChainButtonIncrement({ supply_chain }: { supply_chain: SupplyChainAccount }) {
  const incrementMutation = useSupplyChainIncrementMutation({ supply_chain })

  return (
    <Button variant="outline" onClick={() => incrementMutation.mutateAsync()} disabled={incrementMutation.isPending}>
      Increment
    </Button>
  )
}

export function SupplyChainButtonSet({ supply_chain }: { supply_chain: SupplyChainAccount }) {
  const setMutation = useSupplyChainSetMutation({ supply_chain })

  return (
    <Button
      variant="outline"
      onClick={() => {
        const value = window.prompt('Set value to:', supply_chain.data.count.toString() ?? '0')
        if (!value || parseInt(value) === supply_chain.data.count || isNaN(parseInt(value))) {
          return
        }
        return setMutation.mutateAsync(parseInt(value))
      }}
      disabled={setMutation.isPending}
    >
      Set
    </Button>
  )
}

export function SupplyChainButtonDecrement({ supply_chain }: { supply_chain: SupplyChainAccount }) {
  const decrementMutation = useSupplyChainDecrementMutation({ supply_chain })

  return (
    <Button variant="outline" onClick={() => decrementMutation.mutateAsync()} disabled={decrementMutation.isPending}>
      Decrement
    </Button>
  )
}

export function SupplyChainButtonClose({ supply_chain }: { supply_chain: SupplyChainAccount }) {
  const closeMutation = useSupplyChainCloseMutation({ supply_chain })

  return (
    <Button
      variant="destructive"
      onClick={() => {
        if (!window.confirm('Are you sure you want to close this account?')) {
          return
        }
        return closeMutation.mutateAsync()
      }}
      disabled={closeMutation.isPending}
    >
      Close
    </Button>
  )
}

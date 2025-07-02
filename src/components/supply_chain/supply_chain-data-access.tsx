import {
  SupplyChainAccount,
  getCloseInstruction,
  getSupplyChainProgramAccounts,
  getSupplyChainProgramId,
  getDecrementInstruction,
  getIncrementInstruction,
  getInitializeInstruction,
  getSetInstruction,
} from '@project/anchor'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { generateKeyPairSigner } from 'gill'
import { useWalletUi } from '@wallet-ui/react'
import { useWalletTransactionSignAndSend } from '../solana/use-wallet-transaction-sign-and-send'
import { useClusterVersion } from '@/components/cluster/use-cluster-version'
import { toastTx } from '@/components/toast-tx'
import { useWalletUiSigner } from '@/components/solana/use-wallet-ui-signer'

export function useSupplyChainProgramId() {
  const { cluster } = useWalletUi()
  return useMemo(() => getSupplyChainProgramId(cluster.id), [cluster])
}

export function useSupplyChainProgram() {
  const { client, cluster } = useWalletUi()
  const programId = useSupplyChainProgramId()
  const query = useClusterVersion()

  return useQuery({
    retry: false,
    queryKey: ['get-program-account', { cluster, clusterVersion: query.data }],
    queryFn: () => client.rpc.getAccountInfo(programId).send(),
  })
}

export function useSupplyChainInitializeMutation() {
  const { cluster } = useWalletUi()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner()
  const signAndSend = useWalletTransactionSignAndSend()

  return useMutation({
    mutationFn: async () => {
      const supply_chain = await generateKeyPairSigner()
      return await signAndSend(getInitializeInstruction({ payer: signer, supply_chain }), signer)
    },
    onSuccess: async (tx) => {
      toastTx(tx)
      await queryClient.invalidateQueries({ queryKey: ['supply_chain', 'accounts', { cluster }] })
    },
    onError: () => toast.error('Failed to run program'),
  })
}

export function useSupplyChainDecrementMutation({ supply_chain }: { supply_chain: SupplyChainAccount }) {
  const invalidateAccounts = useSupplyChainAccountsInvalidate()
  const signer = useWalletUiSigner()
  const signAndSend = useWalletTransactionSignAndSend()

  return useMutation({
    mutationFn: async () => await signAndSend(getDecrementInstruction({ supply_chain: supply_chain.address }), signer),
    onSuccess: async (tx) => {
      toastTx(tx)
      await invalidateAccounts()
    },
  })
}

export function useSupplyChainIncrementMutation({ supply_chain }: { supply_chain: SupplyChainAccount }) {
  const invalidateAccounts = useSupplyChainAccountsInvalidate()
  const signAndSend = useWalletTransactionSignAndSend()
  const signer = useWalletUiSigner()

  return useMutation({
    mutationFn: async () => await signAndSend(getIncrementInstruction({ supply_chain: supply_chain.address }), signer),
    onSuccess: async (tx) => {
      toastTx(tx)
      await invalidateAccounts()
    },
  })
}

export function useSupplyChainSetMutation({ supply_chain }: { supply_chain: SupplyChainAccount }) {
  const invalidateAccounts = useSupplyChainAccountsInvalidate()
  const signAndSend = useWalletTransactionSignAndSend()
  const signer = useWalletUiSigner()

  return useMutation({
    mutationFn: async (value: number) =>
      await signAndSend(
        getSetInstruction({
          supply_chain: supply_chain.address,
          value,
        }),
        signer,
      ),
    onSuccess: async (tx) => {
      toastTx(tx)
      await invalidateAccounts()
    },
  })
}

export function useSupplyChainCloseMutation({ supply_chain }: { supply_chain: SupplyChainAccount }) {
  const invalidateAccounts = useSupplyChainAccountsInvalidate()
  const signAndSend = useWalletTransactionSignAndSend()
  const signer = useWalletUiSigner()

  return useMutation({
    mutationFn: async () => {
      return await signAndSend(getCloseInstruction({ payer: signer, supply_chain: supply_chain.address }), signer)
    },
    onSuccess: async (tx) => {
      toastTx(tx)
      await invalidateAccounts()
    },
  })
}

export function useSupplyChainAccountsQuery() {
  const { client } = useWalletUi()

  return useQuery({
    queryKey: useSupplyChainAccountsQueryKey(),
    queryFn: async () => await getSupplyChainProgramAccounts(client.rpc),
  })
}

function useSupplyChainAccountsInvalidate() {
  const queryClient = useQueryClient()
  const queryKey = useSupplyChainAccountsQueryKey()

  return () => queryClient.invalidateQueries({ queryKey })
}

function useSupplyChainAccountsQueryKey() {
  const { cluster } = useWalletUi()

  return ['supply_chain', 'accounts', { cluster }]
}
